import { ResourceHub } from "@/components/resource-hub";

export default function StudentsPage() {
  return (
    <ResourceHub
      title="Students"
      description="Enroll students with their parents or guardians. Parents receive their own login to track their child's progress."
      newHref="/dashboard/students/new"
      newLabel="Enroll student"
      highlights={[
        {
          label: "Parents are linked at enrollment",
          description:
            "Each student must have at least one parent or guardian. The primary contact is who the school calls first.",
        },
        {
          label: "Special needs are confidential",
          description:
            "Note any special needs so teachers and staff can give the right support.",
        },
      ]}
    />
  );
}
