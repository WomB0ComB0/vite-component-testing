import React, { useEffect, useState } from 'react';
import { fetchData as fetchAPIData } from './api/typeSafeFetch';

interface Event{
  title: string;
  thumbnailLink: string;
  detailsLink: string;
}

// React component using getEvents
const GDSCApiComponent = () => {
  const [pastEvents, setPastEvents] = useState<Event[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchAPIData<Event[]>('https://gdsc-api.onrender.com/api/past-events');
        console.log('API Response:', data);
        setPastEvents(data);
      } catch (error) {
        console.error('Error fetching past events:', error);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 24 * 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div>
      <h1>Events List</h1>
      <ul>
        {pastEvents.map((event, index) => (
          <div key={index}>
            <h2>{event.title}</h2>
            <img src={event.thumbnailLink} className={`size-52`} />
            <a href={event.detailsLink} rel='noopener' target={`_blank`}>Link</a>
          </div>
        ))}
      </ul>
    </div>
  );
};

export default GDSCApiComponent;
