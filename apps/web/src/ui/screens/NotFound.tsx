import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <p>That link doesn’t match a lesson, drill or page in FretSense.</p>
      <p><Link to="/library">Go to the lesson library</Link> or <Link to="/">back to the start</Link>.</p>
    </div>
  );
}
