import Changelog from "@/components/screens/Changelog";

/**
 * Public, deliberately unlisted changelog. Nothing in the app links here; the page is `noindex`
 * and absent from `public/sitemap.xml`. See `docs/CHANGELOG.md` before touching it.
 */
export default function ChangelogRoute() {
  return <Changelog />;
}
