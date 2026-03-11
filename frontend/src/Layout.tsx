import { Outlet } from "react-router-dom";
import { Link } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app">
      <nav>
        <Link to="/" className="brand">Vu</Link>
        <Link to="/">Trending</Link>
        <Link to="/">Leaderboard</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
