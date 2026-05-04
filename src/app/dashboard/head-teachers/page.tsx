import { ResourceHub } from "@/components/resource-hub";

export default function HeadTeachersPage() {
  return (
    <ResourceHub
      title="Head teachers"
      description="Manage senior academic staff who lead departments or supervise the school."
      newHref="/dashboard/head-teachers/new"
      newLabel="Add head teacher"
      highlights={[
        {
          label: "Elevated permissions",
          description:
            "Head teachers can supervise classes and gain access to academic reports.",
        },
        {
          label: "Single onboarding flow",
          description:
            "Head teachers receive the same setup link as other staff to activate their accounts.",
        },
      ]}
    />
  );
}
