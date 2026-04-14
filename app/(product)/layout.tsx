import { ProductShell } from "@/components/shell/product-shell";
import { requireViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProductLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await requireViewer();

  return <ProductShell viewer={viewer}>{children}</ProductShell>;
}
