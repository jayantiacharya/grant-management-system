// A user whose only elevated role is college dean. Dean-only users live on
// /college-grants (Dashboard redirects them there and the header hides the
// Dashboard link); users who are also admin/ARCC/chair keep normal navigation.
export function isDeanOnly(
  user: {
    role?: string;
    isArcc?: boolean;
    isDean?: boolean;
    isDeptChair?: boolean;
  } | null,
): boolean {
  return (
    !!user?.isDean && !user.isArcc && !user.isDeptChair && user.role !== "admin"
  );
}
