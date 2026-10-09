import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // /admin/* — must be authenticated admin
  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/", request.url))
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "admin")
      return NextResponse.redirect(new URL("/", request.url))
  }

  // /wizard /tracker — must be authenticated (any role)
  if (pathname.startsWith("/wizard") || pathname.startsWith("/tracker")) {
    if (!user) return NextResponse.redirect(new URL("/", request.url))
  }

  // / — redirect logged-in users to their home
  if (pathname === "/" && user) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role === "admin")
      return NextResponse.redirect(new URL("/admin/dashboard", request.url))
    return NextResponse.redirect(new URL("/wizard", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*\\.png|icon\\.svg|apple-icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
