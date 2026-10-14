import { Alert } from "@/components/ui/alert";
import type { ActionState } from "@/lib/admin/actions";

/** Success/error banner for an admin action, driven only by the server's response. */
export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "success") {
    return (
      <Alert tone="success" role="status" key={state.at}>
        {state.message}
      </Alert>
    );
  }
  if (state.status === "error" && state.message) {
    return (
      <Alert tone="danger" role="alert">
        {state.message}
      </Alert>
    );
  }
  return null;
}
