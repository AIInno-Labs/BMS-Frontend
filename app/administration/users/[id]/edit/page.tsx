import { CreateUserPage } from "@/components/administration/CreateUserPage";

export default async function EditUserRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreateUserPage userId={id} />;
}
