import { describeStack } from "@estate-iq/analysis-engine";
import { SHARED_PACKAGE_NAME } from "@estate-iq/shared";
import { UI_PACKAGE_NAME } from "@estate-iq/ui";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>EstateIQ</h1>
      <p>AI-powered real estate underwriting platform.</p>
      <hr style={{ margin: "1.5rem 0" }} />
      <p>Phase 0 scaffold healthy. Workspace imports resolved:</p>
      <ul>
        <li>shared: {SHARED_PACKAGE_NAME}</li>
        <li>ui: {UI_PACKAGE_NAME}</li>
        <li>analysis-engine: {describeStack()}</li>
      </ul>
    </main>
  );
}
