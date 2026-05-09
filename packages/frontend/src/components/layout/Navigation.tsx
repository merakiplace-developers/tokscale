"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styled, { css, keyframes } from "styled-components";
import { PersonIcon, GearIcon, SignOutIcon } from "@/components/ui/Icons";

interface User {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const MOBILE_BREAKPOINT = "520px";

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

const NavContainer = styled.nav`
  position: fixed;
  top: 17px;
  left: 50%;
  transform: translateX(-50%);
  height: 40px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border-radius: 32px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 50;
  
  @media (max-width: 767px) {
    max-width: 100%;
    gap: 2px;
  }

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    left: 16px;
    right: 16px;
    transform: none;
    width: calc(100% - 32px);
    height: auto;
    flex-direction: column;
    align-items: stretch;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid #10233E;
    background: rgba(0, 0, 0, 0.5);
  }
`;

const NavHeaderRow = styled.div`
  display: contents;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 40px;
    flex-shrink: 0;
  }
`;

const NavItemLink = styled(Link)<{ $isActive: boolean }>`
  font-family: 'Figtree', sans-serif;
  font-weight: 700;
  font-size: 16px;
  text-transform: uppercase;
  padding: 8px 23px;
  border-radius: 1000px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-width: 0;
  
  @media (max-width: 767px) {
    padding: 8px 10px;
  }
  
  ${({ $isActive }) =>
    $isActive
      ? css`
    background: rgba(235, 242, 245, 0.96);
    border: 1px solid rgba(235, 242, 245, 0.96);
    color: #000000;
  `
      : css`
    background: transparent;
    border: 1px solid transparent;
    color: #D9D9D9;
    
    &:hover {
      color: #ffffff;
    }
  `}
`;

const LoadingSkeleton = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 1000px;
  animation: ${pulse} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  background-color: rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
`;

const DisplayName = styled.p`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-fg-default, #e6edf3);
`;
const Username = styled.p`
  font-size: 12px;
  color: var(--color-fg-muted, #848d97);
`;

const ProfileButton = styled.button`
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  background: #0073FF;
  border: 1px solid #0073FF;
  border-radius: 1000px;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
  
  &:hover {
    opacity: 0.9;
  }
`;

const MenuWrapper = styled.div`
  position: relative;
`;

const MenuOverlay = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  background: #1A212A;
  border: 1px solid #1E2733;
  border-radius: 12px;
  overflow: hidden;
  z-index: 100;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
`;

const MenuUserInfo = styled.div`
  padding: 12px;
  border-bottom: 1px solid var(--color-border-default, #30363d);
`;

const MenuDivider = styled.div`
  height: 1px;
  background: var(--color-border-default, #30363d);
`;

const MenuItem = styled(Link)<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: ${({ $danger }) => $danger ? '#F85149' : 'var(--color-fg-default, #e6edf3)'};
  text-decoration: none;
  cursor: pointer;
  transition: background 150ms;
  &:hover {
    background: ${({ $danger }) => $danger ? 'rgba(248, 81, 73, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  }
`;

const MenuItemButton = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 14px;
  width: 100%;
  color: ${({ $danger }) => $danger ? '#F85149' : 'var(--color-fg-default, #e6edf3)'};
  text-decoration: none;
  cursor: pointer;
  transition: background 150ms;
  background: none;
  border: none;
  text-align: left;
  &:hover {
    background: ${({ $danger }) => $danger ? 'rgba(248, 81, 73, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  }
`;

const MenuIconSlot = styled.span`
  display: flex;
  align-items: center;
  color: var(--color-fg-muted, #848d97);
`;

const AvatarImg = styled.img`
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
`;

const DesktopNavItems = styled.div`
  display: contents;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: none;
  }
`;

const DesktopAuthSection = styled.div`
  display: contents;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: none;
  }
`;

const NavLogoLink = styled(Link)`
  display: none;
  flex-shrink: 0;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    padding-left: 8px;
    display: flex;
  }
`;

const NavLogoImage = styled(Image)`
  object-fit: contain;
`;

const HamburgerButton = styled.button`
  display: none;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #D9D9D9;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  border-radius: 1000px;
  transition: color 0.15s ease;

  &:hover {
    color: #ffffff;
  }

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: flex;
  }
`;


const MobileDropdownWrapper = styled.div<{ $isOpen: boolean }>`
  display: none;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: block;
    max-height: ${({ $isOpen }) => ($isOpen ? "500px" : "0")};
    overflow: hidden;
    transition: max-height 0.25s ease-in-out;
  }
`;

const MobileDropdown = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  width: 100%;
`;

const DropdownNavLink = styled(Link)<{ $isActive: boolean }>`
  font-family: var(--font-figtree), 'Figtree', sans-serif;
  font-weight: 700;
  font-size: 15px;
  text-transform: uppercase;
  text-decoration: none;
  padding: 10px 16px;
  border-radius: 12px;
  display: block;
  transition: all 0.15s ease;

  ${({ $isActive }) =>
    $isActive
      ? css`
    background: rgba(0, 115, 255, 0.1);
    color: #ffffff;
  `
      : css`
    background: transparent;
    color: #D9D9D9;

    &:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.06);
    }
  `}
`;

const DropdownDivider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 8px;
`;

const DropdownUserCard = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
`;

const DropdownUserDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const DropdownDisplayName = styled.p`
  font-family: var(--font-figtree), 'Figtree', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DropdownUsername = styled.p`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DropdownUserAction = styled(Link)`
  font-family: var(--font-figtree), 'Figtree', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: #D9D9D9;
  text-decoration: none;
  padding: 10px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.15s ease;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
  }

  svg {
    color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }
`;

const DropdownSignOutButton = styled.button`
  font-family: var(--font-figtree), 'Figtree', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: #F85149;
  background: transparent;
  border: none;
  padding: 10px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(248, 81, 73, 0.1);
  }

  svg {
    color: #F85149;
    flex-shrink: 0;
  }
`;

const MenuIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CloseIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  return (
    <MenuWrapper ref={menuRef}>
      <ProfileButton
        aria-label={`User menu for ${user.username}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen((v) => !v)}
      >
        <AvatarImg
          src={user.avatarUrl || "/default-avatar.svg"}
          alt={user.username}
          width={32}
          height={32}
          style={{ width: "100%", height: "100%" }}
        />
      </ProfileButton>
      {isOpen && (
        <MenuOverlay>
          <MenuUserInfo>
            <DisplayName>{user.displayName || user.username}</DisplayName>
            <Username>@{user.username}</Username>
          </MenuUserInfo>
          <div style={{ padding: "4px 0" }}>
            <MenuItem href={`/u/${user.username}`} onClick={handleClose}>
              <MenuIconSlot><PersonIcon /></MenuIconSlot>
              Your Profile
            </MenuItem>
            <MenuItem href="/settings" onClick={handleClose}>
              <MenuIconSlot><GearIcon /></MenuIconSlot>
              Settings
            </MenuItem>
          </div>
          <MenuDivider />
          <div style={{ padding: "4px 0" }}>
            <MenuItemButton $danger onClick={() => { handleClose(); onSignOut(); }}>
              <MenuIconSlot><SignOutIcon /></MenuIconSlot>
              Sign Out
            </MenuItemButton>
          </div>
        </MenuOverlay>
      )}
    </MenuWrapper>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user || null);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <NavContainer aria-label="Main navigation">
      <NavHeaderRow>
        <NavLogoLink href="/" aria-label="Tokscale home">
          <NavLogoImage
            src="/assets/hero-logo.svg"
            alt="Tokscale"
            width={100}
            height={21}
            priority
          />
        </NavLogoLink>

        <HamburgerButton
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </HamburgerButton>

        <DesktopNavItems>
          <NavItemLink href="/" $isActive={pathname === "/"}>
            About
          </NavItemLink>
          <NavItemLink href="/leaderboard" $isActive={pathname === "/leaderboard"}>
            Leaderboard
          </NavItemLink>
          <NavItemLink href="/profile" $isActive={pathname === "/profile" || pathname.startsWith("/u/")}>
            Profile
          </NavItemLink>
        </DesktopNavItems>

        <DesktopAuthSection>
          {isLoading ? (
            <LoadingSkeleton />
          ) : user ? (
            <UserMenu user={user} onSignOut={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              setUser(null);
              window.location.href = "/leaderboard";
            }} />
          ) : null}
        </DesktopAuthSection>
      </NavHeaderRow>


      <MobileDropdownWrapper $isOpen={isMobileMenuOpen}>
        <MobileDropdown>
          <DropdownNavLink href="/" $isActive={pathname === "/"} onClick={closeMobileMenu}>
            About
          </DropdownNavLink>
          <DropdownNavLink href="/leaderboard" $isActive={pathname === "/leaderboard"} onClick={closeMobileMenu}>
            Leaderboard
          </DropdownNavLink>
          <DropdownNavLink href="/profile" $isActive={pathname === "/profile" || pathname.startsWith("/u/")} onClick={closeMobileMenu}>
            Profile
          </DropdownNavLink>
          <DropdownDivider />

          {isLoading ? null : user ? (
            <>
              <DropdownUserCard>
                <AvatarImg
                  src={user.avatarUrl || "/default-avatar.svg"}
                  alt={user.username}
                  width={32}
                  height={32}
                  style={{ width: "32px", height: "32px" }}
                />
                <DropdownUserDetails>
                  <DropdownDisplayName>{user.displayName || user.username}</DropdownDisplayName>
                  <DropdownUsername>@{user.username}</DropdownUsername>
                </DropdownUserDetails>
              </DropdownUserCard>
              <DropdownUserAction href={`/u/${user.username}`} onClick={closeMobileMenu}>
                <PersonIcon size={16} />
                Your Profile
              </DropdownUserAction>
              <DropdownUserAction href="/settings" onClick={closeMobileMenu}>
                <GearIcon size={16} />
                Settings
              </DropdownUserAction>
              <DropdownSignOutButton
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  setUser(null);
                  closeMobileMenu();
                  window.location.href = "/leaderboard";
                }}
              >
                <SignOutIcon size={16} />
                Sign Out
              </DropdownSignOutButton>
            </>
          ) : null}
        </MobileDropdown>
      </MobileDropdownWrapper>
    </NavContainer>
  );
}
