import { ChevronDown, Plus, Search, X } from "lucide-react";

export function Button({ children, variant = "secondary", icon: Icon, className = "", ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {Icon ? <Icon size={17} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function SplitButton({ children = "Add", onClick, menuOpen, onMenu, items = [] }) {
  return (
    <div className="split-wrap">
      <div className="split-button">
        <button onClick={onClick}><Plus size={18} />{children}</button>
        <button aria-label="Open menu" onClick={onMenu}><ChevronDown size={16} /></button>
      </div>
      {menuOpen ? <div className="menu popover-menu">{items.map((item) => <button key={item.label} onClick={item.onClick}>{item.icon ? <item.icon size={17} /> : null}<span>{item.label}</span></button>)}</div> : null}
    </div>
  );
}

export function PageHeader({ icon: Icon, title, subtitle, actions, eyebrow }) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {Icon ? <span className="page-icon"><Icon size={23} /></span> : null}
        <div>{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search...", className = "" }) {
  return <label className={`search-box ${className}`}><Search size={17} /><input value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} /></label>;
}

export function Tabs({ items, value, onChange, compact = false }) {
  return <div className={`tabs ${compact ? "tabs-compact" : ""}`}>{items.map((item) => <button key={item.value ?? item.label} className={(item.value ?? item.label) === value ? "active" : ""} onClick={() => onChange?.(item.value ?? item.label)}>{item.label}{item.count !== undefined ? <b>{item.count}</b> : null}</button>)}</div>;
}

export function Pill({ children, tone = "neutral" }) { return <span className={`pill pill-${tone}`}>{children}</span>; }

export function Toggle({ checked, onChange, label, ariaLabel }) { return <label className="toggle-row"><button type="button" className={`toggle ${checked ? "on" : ""}`} aria-label={ariaLabel || label || "Toggle setting"} aria-pressed={checked} onClick={() => onChange?.(!checked)}><span /></button>{label ? <span>{label}</span> : null}</label>; }

export function Modal({ open, title, subtitle, onClose, children, className = "" }) {
  if (!open) return null;
  const contextualClass = title === "Create private access link" ? "team-access-modal" : "";
  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}><section className={`modal ${contextualClass} ${className}`}><header><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div><button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={20} /></button></header>{children}</section></div>;
}

export function Drawer({ open, title, subtitle, onClose, children, footer, wide = false }) {
  if (!open) return null;
  return <div className="overlay"><aside className={`drawer ${wide ? "drawer-wide" : ""}`}><header><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div><button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={20} /></button></header><div className="drawer-body">{children}</div>{footer ? <footer>{footer}</footer> : null}</aside></div>;
}

export function EmptyState({ icon: Icon, title, description, action }) { return <div className="empty-state">{Icon ? <Icon size={38} /> : null}<h3>{title}</h3>{description ? <p>{description}</p> : null}{action}</div>; }

export function Field({ label, required, hint, children, className = "" }) { return <label className={`field ${className}`}><span>{label}{required ? <em>*</em> : null}{hint ? <small>{hint}</small> : null}</span>{children}</label>; }
