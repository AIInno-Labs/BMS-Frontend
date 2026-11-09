import { CustomersListPage } from "@/components/CustomersListPage";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";

export default function CrmRoutePage() {
  return (
    <RequireAccess accessKey={ACCESS_KEYS.CUSTOMERS_VIEW}>
      <CustomersListPage />
    </RequireAccess>
  );
}
