
import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function LineChart({labels, data}){
  const cfg = {
    labels,
    datasets: [{
      label: 'Bookings',
      data,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.1)',
      tension: 0.3,
      fill: true,
      pointRadius: 3
    }]
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false } }
  };
  return <Line data={cfg} options={options} />;
}
