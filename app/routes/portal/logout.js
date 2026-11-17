import { json } from "@remix-run/node";
import { destroyUserSession } from "~/utils/auth.server";

export async function loader({ request }) {
  return destroyUserSession(request);
}

export async function action({ request }) {
  return destroyUserSession(request);
}
