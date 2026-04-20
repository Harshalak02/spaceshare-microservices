function SpaceList({ spaces, onBook }) {
  if (!spaces || spaces.length === 0) return null;

  return (
    <div>
      <h3>Results ({spaces.length} spaces found)</h3>
      {spaces.map((id) => (
        <div key={id} style={{ border: '1px solid #ccc', padding: 12, margin: '8px 0', borderRadius: 4 }}>
          <p><strong>Space ID:</strong> {id}</p>
          <button onClick={() => onBook(id)} style={{ padding: '4px 12px' }}>📅 Book</button>
        </div>
      ))}
    </div>
  );
}

export default SpaceList;
