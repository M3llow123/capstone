import { cookies } from "next/headers";
import ImpactAssessmentPage from "../components/Impactassessmentpage";
import { SESSION_COOKIE, getSessionUsername } from "../lib/auth";

export default async function UploaderPage() {
  const store = await cookies();
  const username =
    (await getSessionUsername(
      store.get(SESSION_COOKIE)?.value,
      process.env.AUTH_SECRET
    )) ?? "User";

  return <ImpactAssessmentPage username={username} />;
}