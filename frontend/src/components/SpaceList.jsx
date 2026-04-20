function SpaceList({ spaces, onBook }) {
  return (
    <div>
      <h3>Results</h3>
      {spaces.length === 0 && <p>No spaces found.</p>}
      {spaces.map((id) => (
        <div key={id} style={{ border: '1px solid #ccc', padding: 8, margin: '8px 0' }}>
          <p>Space ID: {id}</p>
          <button onClick={() => onBook(id)}>Book</button>
        </div>
      ))}
    </div>
  );
}

export default SpaceList;
