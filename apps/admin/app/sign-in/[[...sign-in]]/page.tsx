import { redirect } from "next/navigation";

// Keep old bookmarks and invitation links working; middleware preserves their query parameters.
export default function SignInPage() {
  redirect("/");
}
