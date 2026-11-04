import Link from "next/link";
import { currentUser } from "@/lib/session";

export default async function Header() {
  const user = await currentUser();
  return (
    <header className="site-header">
      <div className="container header-row">
        <Link href={user ? "/home" : "/"} className="logo">Ketchup</Link>
        <nav className="header-nav">
          {user ? (
            <>
              <Link href="/home" className="navlink">Dashboard</Link>
              <span className="muted">{user.name}</span>
              <form action="/api/auth/logout" method="post">
                <button className="btn" type="submit">Log out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn">Log in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
