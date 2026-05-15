
import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function BarChart({labels, data}){
  const cfg = {
    labels,
    datasets: [{
      label: 'Revenue',
      data,
      backgroundColor: '#10b981'
    }]
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false } }
  };
  return <Bar data={cfg} options={options} />;
}
