function SpaceList({ spaces, onBook }) {
  if (!spaces || spaces.length === 0) return null;

  return (
    <div className="stack">
      <h3>Results ({spaces.length} spaces found)</h3>
      {spaces.map((id) => (
        <div key={id} className="card simple-result-card">
          <p><strong>Space ID:</strong> {id}</p>
          <button className="btn btn-primary" type="button" onClick={() => onBook(id)}>Book</button>
        </div>
      ))}
    </div>
  );
}

export default SpaceList;
