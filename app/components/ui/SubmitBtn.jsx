import { useNavigation } from '@remix-run/react';

function SubmitButton({ txt = 'Submit', fetcher, ...props }) {
  const transition = useNavigation();

  // Determine if we're using fetcher or the normal form submission
  const isSubmitting = fetcher ? fetcher.state === 'submitting' : transition.state === 'submitting';
  console.log('isSubmitting', transition.state);
  return (
    <button {...props} disabled={isSubmitting} type="submit">
      {isSubmitting && (
        <div>
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Please wait...
        </div>
      )}
      {!isSubmitting && txt}
    </button>
  );
}

export default SubmitButton;
