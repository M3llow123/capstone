import { cookies } from "next/headers";
import AuditLogPage from "../components/AuditLogPage";
import { SESSION_COOKIE, getSessionUsername } from "../lib/auth";

export default async function AuditLogRoute() {
  const store = await cookies();
  const username =
    (await getSessionUsername(
      store.get(SESSION_COOKIE)?.value,
      process.env.AUTH_SECRET
    )) ?? "User";

  return <AuditLogPage username={username} />;
}
