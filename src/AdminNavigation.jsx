import { adminGroups } from './admin-navigation.js';

export default function AdminNavigation({ tab, features, busy, onChange }) {
  const groups = adminGroups(features);
  return <nav className="admin-navigation" aria-label="Phần quản trị">
    <label className="admin-mobile-navigation">Mục quản trị
      <select value={tab} disabled={busy} onChange={event => onChange(event.target.value)}>
        {groups.map(([name, tabs]) => <optgroup key={name} label={name}>
          {tabs.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </optgroup>)}
      </select>
    </label>
    <div className="admin-navigation-groups">
      {groups.map(([name, tabs]) => <section key={name} aria-label={name}>
        <h2>{name}</h2>
        {tabs.map(([key, label]) => <button key={key} disabled={busy}
          aria-current={tab === key ? 'page' : undefined} onClick={() => onChange(key)}>{label}</button>)}
      </section>)}
    </div>
  </nav>;
}
