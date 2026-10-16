/** Display wording only; never use these labels as API status values. */
export function bookingStatusDisplay(status: string) {
  switch (status.trim().toLowerCase()) {
    case "cancelled": return { label: "Cancelled", description: "Cancelled" };
    case "completed": return { label: "Completed", description: "Completed service" };
    default: return { label: undefined, description: undefined };
  }
}

/** Course progress is separate from the appointment's booking status. */
export function vaccinationCourseLabel(progress?: "ongoing" | "completed" | "cancelled" | null) {
  return progress === "cancelled" ? "Not Continued" : progress === "completed" ? "Completed" : "Ongoing";
}

