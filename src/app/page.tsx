import { redirect } from "next/navigation";

export default function Home() {
  // The app lives under /dashboard (protected). Send everyone there;
  // the protected layout bounces logged-out users to /signin.
  redirect("/dashboard");
}
