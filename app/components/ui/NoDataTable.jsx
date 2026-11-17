function NoDataTable({ ...props }) {
  const { data } = props || {};
  return (
    <>
      {data.length === 0 ? (
        <tfoot>
          <tr>
            <td colSpan="5" className="text-center">
              No data found
            </td>
          </tr>
        </tfoot>
      ) : null}
    </>
  );
}

export default NoDataTable;
