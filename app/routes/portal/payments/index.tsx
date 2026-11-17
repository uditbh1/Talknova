import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form, Link, useSubmit } from '@remix-run/react';
import { useEffect, useMemo } from 'react';
import feather from 'feather-icons';
import AdminLayout from '~/components/Layout';
import { getUserFromSession } from '~/utils/auth.server';
import { Transaction } from '~/models/transaction';
import { User } from '~/models/user';
import { PlanModel } from '~/models/plan';

const escapeRegex = (value: string) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  // Only super admin can access
  if (!user.roles?.includes('SUPER_ADMIN')) {
    return redirect('/portal');
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() || '';
  const statusFilter = url.searchParams.get('status')?.trim() || 'ALL';
  const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 20;

  const baseFilter: any = {};
  if (statusFilter && statusFilter !== 'ALL') {
    baseFilter.status = statusFilter;
  }

  const filter: any = { ...baseFilter };
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { vendorTxCode: regex },
      { customerEmail: regex },
      { customerName: regex },
      { billingFirstNames: regex },
      { billingSurname: regex },
      { stripeSessionId: regex },
    ];
  }

  const totalItems = await Transaction.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = totalPages > 0 ? Math.min(Math.max(pageParam, 1), totalPages) : 1;
  const skip = (currentPage - 1) * pageSize;

  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .populate('user', 'firstName lastName email')
    .populate('plan', 'name price')
    .lean();

  const pagination = {
    currentPage,
    totalPages,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    totalItems,
    pageSize,
  };

  const statusOptions = ['ALL', 'INITIATED', 'PENDING', 'OK', 'FAILED', 'CANCELED'];

  return json({
    user: JSON.parse(JSON.stringify(user)), // Include user for Navbar component
    transactions: JSON.parse(JSON.stringify(transactions)),
    pagination,
    filters: {
      search,
      status: statusFilter || 'ALL',
    },
    statusOptions,
  });
};

const statusBadgeClass: Record<string, string> = {
  OK: 'bg-success',
  PENDING: 'bg-warning text-dark',
  INITIATED: 'bg-primary',
  FAILED: 'bg-danger',
  CANCELED: 'bg-secondary',
};

const formatDateTime = (value: string | Date | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (amount: number, currency: string = 'GBP') => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount);
};

export default function PaymentsPage() {
  const { transactions, pagination, filters, statusOptions } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  useEffect(() => {
    feather.replace();
  }, [transactions]);

  const showingFrom = useMemo(() => {
    if (transactions.length === 0) return 0;
    return (pagination.currentPage - 1) * pagination.pageSize + 1;
  }, [transactions, pagination.currentPage, pagination.pageSize]);

  const showingTo = useMemo(() => {
    if (transactions.length === 0) return 0;
    return showingFrom + transactions.length - 1;
  }, [transactions, showingFrom]);

  const statusClassFor = (status: string) => statusBadgeClass[status] || 'bg-light text-dark';

  const buildPageLink = (page: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    params.set('page', page.toString());
    return `?${params.toString()}`;
  };

  return (
    <AdminLayout>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">Payment History</h3>
              <p className="text-white-50 mb-0">Review and audit all payment transactions</p>
            </div>
            <Link to="/portal" className="btn btn-white">
              <i data-feather="arrow-left" className="icon-xs me-1" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <Form method="get" className="row g-3 align-items-end">
            <input type="hidden" name="page" value="1" />
            <div className="col-md-5 col-lg-4">
              <label className="form-label" htmlFor="payment-search">
                Search
              </label>
              <input
                type="search"
                id="payment-search"
                name="search"
                className="form-control"
                placeholder="Search by name, email, transaction ID"
                defaultValue={filters.search}
              />
            </div>
            <div className="col-md-4 col-lg-3">
              <label className="form-label" htmlFor="payment-status">
                Status
              </label>
              <select
                id="payment-status"
                name="status"
                className="form-select"
                defaultValue={filters.status || 'ALL'}
                onChange={(event) => submit(event.currentTarget.form)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === 'ALL' ? 'All Statuses' : status}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 col-lg-2">
              <button type="submit" className="btn btn-primary w-100">
                <i data-feather="search" className="icon-xs me-1" />
                Search
              </button>
            </div>
          </Form>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card mt-4">
        <div className="card-body">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mb-3 gap-2">
            <h5 className="mb-0">Transactions</h5>
            <span className="text-muted small">
              Showing {showingFrom}-{showingTo} of {pagination.totalItems}
            </span>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Transaction ID</th>
                  <th style={{ minWidth: 200 }}>Customer</th>
                  <th style={{ minWidth: 160 }}>Plan</th>
                  <th style={{ minWidth: 120 }}>Amount</th>
                  <th style={{ minWidth: 100 }}>Period</th>
                  <th style={{ minWidth: 140 }}>Status</th>
                  <th style={{ minWidth: 180 }}>Stripe Session</th>
                  <th style={{ minWidth: 160 }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction: any) => {
                    const user = transaction.user;
                    const plan = transaction.plan;
                    return (
                      <tr key={transaction._id}>
                        <td>
                          <div className="d-flex flex-column gap-1">
                            <span className="fw-semibold">{transaction.vendorTxCode || '—'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-1">
                            <span className="fw-semibold">
                              {user ? `${user.firstName} ${user.lastName}` : transaction.customerName || '—'}
                            </span>
                            <span className="text-muted small">{transaction.customerEmail || '—'}</span>
                          </div>
                        </td>
                        <td>
                          {plan ? (
                            <span className="badge bg-info text-white">{plan.name}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className="fw-semibold">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark text-capitalize">
                            {transaction.period || '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${statusClassFor(transaction.status)}`}>
                            {transaction.status || '—'}
                          </span>
                        </td>
                        <td>
                          {transaction.stripeSessionId ? (
                            <span className="text-muted small font-monospace">
                              {transaction.stripeSessionId.substring(0, 20)}...
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className="text-muted small">
                            {formatDateTime(transaction.createdAt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-4">
              <div className="text-muted small">
                Page {pagination.currentPage} of {pagination.totalPages}
              </div>
              <nav>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${!pagination.hasPrevPage ? 'disabled' : ''}`}>
                    <Link
                      className="page-link"
                      to={buildPageLink(pagination.currentPage - 1)}
                      aria-label="Previous"
                    >
                      <span aria-hidden="true">&laquo;</span>
                    </Link>
                  </li>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.currentPage - 2 + i;
                    }
                    return (
                      <li
                        key={pageNum}
                        className={`page-item ${pageNum === pagination.currentPage ? 'active' : ''}`}
                      >
                        <Link className="page-link" to={buildPageLink(pageNum)}>
                          {pageNum}
                        </Link>
                      </li>
                    );
                  })}
                  <li className={`page-item ${!pagination.hasNextPage ? 'disabled' : ''}`}>
                    <Link
                      className="page-link"
                      to={buildPageLink(pagination.currentPage + 1)}
                      aria-label="Next"
                    >
                      <span aria-hidden="true">&raquo;</span>
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

