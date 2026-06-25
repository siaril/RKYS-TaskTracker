import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { googleSignIn } from "@/lib/actions/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <Image
        src="/login-bg.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/rekayasa-logo.png"
            alt="Rekayasa Analisa Digital"
            width={285}
            height={184}
            priority
            className="mb-3 h-auto w-44"
          />
          <h1 className="text-xl font-bold text-ink">Welcome to Rekayasa Task Trackers</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to manage your team&apos;s projects and tasks.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-negative/10 px-4 py-2 text-center text-sm text-negative">
            This account isn&apos;t authorized to use Rekayasa Task Tracker. Contact your admin if you
            think this is a mistake.
          </p>
        )}

        <form action={googleSignIn}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border-strong bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-app"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
