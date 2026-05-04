import { ResourceHub } from "@/components/resource-hub";

export default function TeachersPage() {
  return (
    <ResourceHub
      title="Teachers"
      description="Onboard teachers to your school. They'll receive an email with a link to set up their account."
      newHref="/dashboard/teachers/new"
      newLabel="Add teacher"
      highlights={[
        {
          label: "Each teacher gets a personal account",
          description:
            "After you add a teacher, they receive an onboarding link to set their password.",
        },
        {
          label: "Link teachers to classes later",
          description:
            "You'll be able to assign teachers to subjects and classrooms once your roster is ready.",
        },
      ]}
    />
  );
}
