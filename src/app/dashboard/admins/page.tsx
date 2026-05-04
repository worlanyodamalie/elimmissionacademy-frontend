import { ResourceHub } from "@/components/resource-hub";

export default function AdminsPage() {
  return (
    <ResourceHub
      title="Administrators"
      description="Grant trusted staff access to manage your school's data."
      newHref="/dashboard/admins/new"
      newLabel="Add administrator"
      highlights={[
        {
          label: "Full school access",
          description:
            "Administrators can register staff, enroll students, and manage settings.",
        },
        {
          label: "Use sparingly",
          description:
            "Only invite people you trust. Administrators can add or remove other accounts.",
        },
      ]}
    />
  );
}
