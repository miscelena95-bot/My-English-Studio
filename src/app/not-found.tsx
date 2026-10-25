import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="page page-narrow">
      <EmptyState title="We couldn't find that page" action={<ButtonLink href="/" variant="primary">Back to your learning space</ButtonLink>}>
        The link may be out of date, or the item may have been deleted.
      </EmptyState>
    </div>
  );
}
