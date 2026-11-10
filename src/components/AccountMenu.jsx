import { useState, useRef, useEffect } from "react";

export function AccountMenu({ user, onLogout, activeView, setActiveView }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  return (
    <div className="account-menu-container" ref={menuRef}>
      <button
        className="account-badge-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`Account: @${user.login}`}
      >
        <img
          src={user.avatarUrl || "/cat-white.svg"}
          alt={`@${user.login}`}
          className="account-avatar"
        />
        <span className="account-username">@{user.login}</span>
        <i className={`fa-solid fa-chevron-${isOpen ? "up" : "down"} account-chevron`}></i>
      </button>

      {isOpen && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-header">
            <img
              src={user.avatarUrl || "/cat-white.svg"}
              alt=""
              className="dropdown-avatar"
            />
            <div className="dropdown-user-info">
              <span className="dropdown-user-name">{user.name || user.login}</span>
              <span className="dropdown-user-login">@{user.login}</span>
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <div className="dropdown-links">
            <button
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setActiveView(activeView === "dashboard" ? "editor" : "dashboard");
                setIsOpen(false);
              }}
            >
              <i className={`fa-solid ${activeView === "dashboard" ? "fa-paint-brush" : "fa-layer-group"}`}></i>
              <span>{activeView === "dashboard" ? "Open Pixel Editor" : "Open Dashboard"}</span>
            </button>

            <a
              href={user.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="dropdown-item"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <i className="fa-brands fa-github"></i>
              <span>GitHub Profile</span>
              <i className="fa-solid fa-arrow-up-right-from-square external-icon"></i>
            </a>

            <div className="dropdown-divider"></div>

            <button
              className="dropdown-item dropdown-item-danger"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
