import { CreateRolePage } from "@/components/administration/CreateRolePage";

export default async function EditRoleRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreateRolePage roleId={id} />;
}
