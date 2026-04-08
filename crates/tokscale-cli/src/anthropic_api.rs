use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;

fn home_dir() -> Result<PathBuf> {
    dirs::home_dir().context("Could not determine home directory")
}

fn ensure_config_dir() -> Result<()> {
    let config_dir = home_dir()?.join(".config/tokscale");
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&config_dir, fs::Permissions::from_mode(0o700))?;
        }
    }
    Ok(())
}

fn atomic_write_file(path: &std::path::Path, contents: &str) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Invalid cache path"))?;
    if !parent.exists() {
        fs::create_dir_all(parent)?;
    }

    let temp_name = format!(
        ".tmp-anthropic-{}",
        std::process::id()
    );
    let temp_path = parent.join(temp_name);

    #[cfg(unix)]
    {
        use std::fs::OpenOptions;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&temp_path)?;
        file.write_all(contents.as_bytes())?;
    }

    #[cfg(not(unix))]
    {
        fs::write(&temp_path, contents)?;
    }

    if let Err(err) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(err.into());
    }
    Ok(())
}

// ── Credentials ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicCredentials {
    #[serde(rename = "adminKey")]
    pub admin_key: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

fn get_credentials_path() -> Result<PathBuf> {
    Ok(home_dir()?.join(".config/tokscale/anthropic-credentials.json"))
}

fn get_cache_dir() -> Result<PathBuf> {
    Ok(home_dir()?.join(".config/tokscale/anthropic-cache"))
}

pub fn load_credentials() -> Option<AnthropicCredentials> {
    let path = get_credentials_path().ok()?;
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn save_credentials(admin_key: &str) -> Result<()> {
    ensure_config_dir()?;
    let creds = AnthropicCredentials {
        admin_key: admin_key.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    let path = get_credentials_path()?;
    let json = serde_json::to_string_pretty(&creds)?;
    atomic_write_file(&path, &json)?;
    Ok(())
}

pub fn is_logged_in() -> bool {
    load_credentials().is_some()
}

pub fn has_cache() -> bool {
    get_cache_dir()
        .ok()
        .and_then(|d| d.join("usage.csv").exists().then_some(()))
        .is_some()
}

// ── API Fetch ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct UsageReportResponse {
    data: Vec<UsageBucket>,
}

#[derive(Debug, Deserialize)]
struct UsageBucket {
    #[serde(default)]
    snapshot_date: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    input_tokens: i64,
    #[serde(default)]
    output_tokens: i64,
    #[serde(default)]
    cache_read_input_tokens: i64,
    #[serde(default)]
    cache_creation_input_tokens: i64,
}

pub struct SyncResult {
    pub synced: bool,
    pub rows: usize,
    pub error: Option<String>,
}

pub async fn sync_anthropic_cache(
    since: Option<String>,
    until: Option<String>,
) -> SyncResult {
    let creds = match load_credentials() {
        Some(c) => c,
        None => {
            return SyncResult {
                synced: false,
                rows: 0,
                error: Some("Not authenticated. Run 'tokscale sync-api --anthropic' to set up.".to_string()),
            };
        }
    };

    let cache_dir = match get_cache_dir() {
        Ok(d) => d,
        Err(e) => {
            return SyncResult {
                synced: false,
                rows: 0,
                error: Some(format!("Failed to get cache dir: {}", e)),
            };
        }
    };

    if let Err(e) = fs::create_dir_all(&cache_dir) {
        return SyncResult {
            synced: false,
            rows: 0,
            error: Some(format!("Failed to create cache dir: {}", e)),
        };
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&cache_dir, fs::Permissions::from_mode(0o700));
    }

    // Default: last 90 days
    let end_date = until.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    let start_date = since.unwrap_or_else(|| {
        (chrono::Utc::now() - chrono::Duration::days(90))
            .format("%Y-%m-%d")
            .to_string()
    });

    match fetch_usage(&creds.admin_key, &start_date, &end_date).await {
        Ok(csv_text) => {
            let row_count = csv_text.lines().count().saturating_sub(1); // minus header
            let file_path = cache_dir.join("usage.csv");
            if let Err(e) = atomic_write_file(&file_path, &csv_text) {
                return SyncResult {
                    synced: false,
                    rows: 0,
                    error: Some(format!("Failed to write cache: {}", e)),
                };
            }
            SyncResult {
                synced: true,
                rows: row_count,
                error: None,
            }
        }
        Err(e) => SyncResult {
            synced: false,
            rows: 0,
            error: Some(format!("API fetch failed: {}", e)),
        },
    }
}

async fn fetch_usage(admin_key: &str, start_date: &str, end_date: &str) -> Result<String> {
    let client = reqwest::Client::new();

    let response = client
        .get("https://api.anthropic.com/v1/organizations/usage")
        .header("x-api-key", admin_key)
        .header("anthropic-version", "2023-06-01")
        .query(&[
            ("start_date", start_date),
            ("end_date", end_date),
            ("group_by", "model"),
            ("granularity", "day"),
        ])
        .send()
        .await?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED
        || response.status() == reqwest::StatusCode::FORBIDDEN
    {
        anyhow::bail!(
            "Anthropic Admin API key is invalid or lacks permission. Verify your key at console.anthropic.com."
        );
    }

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Anthropic API returned status {}: {}", status, body);
    }

    let report: UsageReportResponse = response.json().await?;

    // Convert to CSV
    let mut csv = String::from("Date,Model,Input,Output,CacheRead,CacheWrite,Cost\n");
    for bucket in &report.data {
        let date = bucket.snapshot_date.as_deref().unwrap_or("");
        let model = bucket.model.as_deref().unwrap_or("unknown");
        if date.is_empty() {
            continue;
        }
        csv.push_str(&format!(
            "{},{},{},{},{},{},0\n",
            date,
            model,
            bucket.input_tokens,
            bucket.output_tokens,
            bucket.cache_read_input_tokens,
            bucket.cache_creation_input_tokens,
        ));
    }

    Ok(csv)
}
