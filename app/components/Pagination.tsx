// Pagination.tsx
import { Link } from '@remix-run/react';

export default function Pagination({ currentPage, totalPages, getPageLink }) {
  const pageNumbers = [];

  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Page navigation">
      <ul className="pagination">
        {currentPage > 1 && (
          <li className="page-item">
            <Link className="page-link" to={getPageLink(currentPage - 1)} aria-label="Previous">
              &laquo;
            </Link>
          </li>
        )}
        {pageNumbers.map(number => (
          <li key={number} className={`page-item${number === currentPage ? ' active' : ''}`}>
            <Link className="page-link" to={getPageLink(number)}>
              {number}
            </Link>
          </li>
        ))}
        {currentPage < totalPages && (
          <li className="page-item">
            <Link className="page-link" to={getPageLink(currentPage + 1)} aria-label="Next">
              &raquo;
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
