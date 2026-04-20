import { useState } from 'react';
import SearchForm from '../components/SearchForm';
import SpaceList from '../components/SpaceList';
import { apiRequest } from '../services/api';

function SearchPage({ token, user }) {
  const [spaceIds, setSpaceIds] = useState([]);

  async function onSearch(query) {
    const params = new URLSearchParams(query).toString();
    const result = await apiRequest(`/search?${params}`);
    setSpaceIds(result.space_ids || []);
  }

  async function onBook(spaceId) {
    const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await apiRequest('/bookings/book', 'POST', {
      space_id: spaceId,
      user_id: user.id,
      start_time: start,
      end_time: end
    }, token);
    alert('Booking created!');
  }

  return (
    <div>
      <SearchForm onSearch={onSearch} />
      <SpaceList spaces={spaceIds} onBook={onBook} />
    </div>
  );
}

export default SearchPage;
