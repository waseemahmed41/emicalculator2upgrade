'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, PieChart, Pie, Cell } from 'recharts';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import * as THREE from 'three';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Disable right-click and developer tools shortcuts
if (typeof window !== 'undefined') {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.key === 'U')) {
      e.preventDefault();
    }
  });
  // Disable text selection
  document.addEventListener('selectstart', (e) => e.preventDefault());
  // Disable drag
  document.addEventListener('dragstart', (e) => e.preventDefault());
}

interface EMIData {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  paymentFrequency: 'monthly' | 'quarterly' | 'half-yearly';
  monthlyData: Array<{
    month: number;
    principal: number;
    interest: number;
    balance: number;
    date: Date;
  }>;
  frequencyData: Array<{
    period: number;
    principal: number;
    interest: number;
    balance: number;
    date: Date;
  }>;
}

interface LeadForm {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}

export default function EMICalculator() {
  const [loanAmount, setLoanAmount] = useState(270000);
  const [interestRate, setInterestRate] = useState(6);
  const [tenure, setTenure] = useState(6);
  const [additionalMonths, setAdditionalMonths] = useState(0);
  const [startDate, setStartDate] = useState('2026-02-12');
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'quarterly' | 'half-yearly'>('monthly');
  const [emiData, setEMIData] = useState<EMIData | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [leadForm, setLeadForm] = useState<LeadForm>({ name: '', email: '', phone: '', service: '', message: '' });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate EMI whenever inputs change
  useEffect(() => {
    calculateEMI();
  }, [loanAmount, interestRate, tenure, additionalMonths, startDate, paymentFrequency]);

  const calculateEMI = () => {
    const principal = loanAmount;
    const monthlyRate = interestRate / 12 / 100; // Monthly interest rate
    const totalMonths = tenure * 12 + additionalMonths; // Total months including additional

    if (principal <= 0 || monthlyRate <= 0 || totalMonths <= 0) {
      setEMIData(null);
      return;
    }

    // Calculate monthly EMI
    const monthlyEMI = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    
    // Calculate payment amount based on frequency
    let paymentAmount: number;
    let periodsPerYear: number;
    
    switch (paymentFrequency) {
      case 'quarterly':
        paymentAmount = monthlyEMI * 3;
        periodsPerYear = 4;
        break;
      case 'half-yearly':
        paymentAmount = monthlyEMI * 6;
        periodsPerYear = 2;
        break;
      default: // monthly
        paymentAmount = monthlyEMI;
        periodsPerYear = 12;
    }

    const totalPayment = monthlyEMI * totalMonths;
    const totalInterest = totalPayment - principal;

    // Generate monthly data for charts
    const monthlyData = [];
    let remainingBalance = principal;
    const start = new Date(startDate);

    for (let month = 1; month <= totalMonths; month++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = monthlyEMI - interestPayment;
      remainingBalance -= principalPayment;

      const currentDate = new Date(start);
      currentDate.setMonth(currentDate.getMonth() + month - 1);

      monthlyData.push({
        month,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, remainingBalance),
        date: currentDate
      });
    }

    // Generate frequency-specific data for display
    const frequencyData = [];
    remainingBalance = principal;
    const totalPeriods = Math.floor(totalMonths / (12 / periodsPerYear));
    
    for (let period = 1; period <= totalPeriods; period++) {
      let periodPrincipal = 0;
      let periodInterest = 0;
      const monthsInPeriod = 12 / periodsPerYear;
      
      for (let i = 0; i < monthsInPeriod; i++) {
        const monthIndex = (period - 1) * monthsInPeriod + i;
        if (monthIndex < monthlyData.length) {
          periodPrincipal += monthlyData[monthIndex].principal;
          periodInterest += monthlyData[monthIndex].interest;
        }
      }
      
      remainingBalance -= periodPrincipal;
      
      const currentDate = new Date(start);
      if (paymentFrequency === 'quarterly') {
        currentDate.setMonth(currentDate.getMonth() + (period - 1) * 3);
      } else if (paymentFrequency === 'half-yearly') {
        currentDate.setMonth(currentDate.getMonth() + (period - 1) * 6);
      } else {
        currentDate.setMonth(currentDate.getMonth() + period - 1);
      }

      frequencyData.push({
        period,
        principal: periodPrincipal,
        interest: periodInterest,
        balance: Math.max(0, remainingBalance),
        date: currentDate
      });
    }

    setEMIData({
      emi: paymentAmount,
      totalInterest,
      totalPayment,
      paymentFrequency,
      monthlyData,
      frequencyData
    });
  };

  const handleCalculateFullSchedule = () => {
    // Show contact form, but don't show schedule yet
    setShowLeadForm(true);
  };

  const handleSliderChange = useCallback((value: number, setter: (val: number) => void) => {
    setter(value);
  }, []);

  // Real-time slider handlers with debouncing for smooth performance
  const handleLoanAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLoanAmount(value);
  }, []);

  const handleInterestRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setInterestRate(value);
  }, []);

  const handleTenureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setTenure(value);
  }, []);

  const handleAdditionalMonthsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setAdditionalMonths(value);
  }, []);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form Submitted:', leadForm);
    // Handle form submission here
    alert('Thank you for your inquiry! We will contact you soon.');
    // Hide form and show schedule
    setShowLeadForm(false);
    setTimeout(() => setShowSchedule(true), 300);
    // Reset form
    setLeadForm({ name: '', email: '', phone: '', service: '', message: '' });
  };

  const handlePrintToPDF = async () => {
    const element = document.getElementById('amortization-schedule');
    if (element && emiData) {
      // Create a temporary table with monthly data for PDF
      const tempDiv = document.createElement('div');
      tempDiv.style.padding = '20px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.color = 'black';
      
      // Add title
      const title = document.createElement('h2');
      title.textContent = 'EMI Amortization Schedule (Monthly Breakdown)';
      title.style.marginBottom = '20px';
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      tempDiv.appendChild(title);
      
      // Add loan details
      const details = document.createElement('div');
      details.style.marginBottom = '20px';
      details.innerHTML = `
        <p><strong>Loan Amount:</strong> ₹${loanAmount.toLocaleString()}</p>
        <p><strong>Annual Interest Rate:</strong> ${interestRate}%</p>
        <p><strong>Tenure:</strong> ${tenure} years${additionalMonths > 0 ? ` ${additionalMonths} months` : ''}</p>
        <p><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString('en-GB')}</p>
        <p><strong>Payment Frequency:</strong> ${paymentFrequency}</p>
        <p><strong>Monthly EMI:</strong> ₹${(emiData.totalPayment / (tenure * 12 + additionalMonths)).toFixed(2)}</p>
        <p><strong>Total Interest:</strong> ₹${emiData.totalInterest.toFixed(2)}</p>
        <p><strong>Total Payment:</strong> ₹${emiData.totalPayment.toFixed(2)}</p>
      `;
      tempDiv.appendChild(details);
      
      // Create table with monthly data
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.marginTop = '20px';
      
      // Add header
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      ['#', 'Date', 'Payment', 'Principal', 'Interest', 'Balance'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.border = '1px solid #ddd';
        th.style.padding = '8px';
        th.style.backgroundColor = '#f2f2f2';
        th.style.textAlign = text === '#' || text === 'Date' ? 'left' : 'right';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      // Add monthly data rows
      const tbody = document.createElement('tbody');
      const monthlyEMI = emiData.totalPayment / (tenure * 12 + additionalMonths);
      emiData.monthlyData.forEach((data, index) => {
        const row = document.createElement('tr');
        const cellData = [
          index + 1,
          data.date.toLocaleDateString('en-GB'),
          `₹${monthlyEMI.toFixed(2)}`,
          `₹${data.principal.toFixed(2)}`,
          `₹${data.interest.toFixed(2)}`,
          `₹${data.balance.toFixed(2)}`
        ];
        
        cellData.forEach((text, i) => {
          const td = document.createElement('td');
          td.textContent = text;
          td.style.border = '1px solid #ddd';
          td.style.padding = '8px';
          td.style.textAlign = i === 0 || i === 1 ? 'left' : 'right';
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tempDiv.appendChild(table);
      
      document.body.appendChild(tempDiv);
      
      const canvas = await html2canvas(tempDiv);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('emi-amortization-schedule.pdf');
      
      // Clean up
      document.body.removeChild(tempDiv);
    }
  };

  // Custom 3D Donut Chart Component
  const Custom3DDonut = ({ data }: { data: any[] }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const principalPercentage = ((data[0]?.value / total) * 100).toFixed(1);
    
    return (
      <div className="relative">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <defs>
              <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.3"/>
              </filter>
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              filter="url(#shadow)"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`url(#${entry.name.toLowerCase()}Gradient)`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-white/60 text-sm">Monthly EMI</p>
          <p className="text-white text-2xl font-bold">₹{emiData?.emi.toFixed(0)}</p>
          <p className="text-blue-400 text-xs mt-1">{principalPercentage}% Principal</p>
        </div>
      </div>
    );
  };

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black/90 backdrop-blur-lg p-3 rounded-xl border border-white/20 shadow-2xl"
        >
          <p className="text-white font-medium">Month {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ₹{entry.value.toFixed(2)}
            </p>
          ))}
        </motion.div>
      );
    }
    return null;
  };
  function Coin3D() {
    return (
      <Box args={[2, 2, 0.3]} rotation={[0, 0, 0]}>
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </Box>
    );
  }

  const pieData = emiData ? [
    { name: 'Principal', value: loanAmount, color: '#3b82f6' },
    { name: 'Interest', value: emiData.totalInterest, color: '#f97316' }
  ] : [];

  const lineData = emiData ? emiData.monthlyData.map(data => ({
    month: data.month,
    principal: data.principal,
    interest: data.interest,
    balance: data.balance,
    total: data.principal + data.interest
  })) : [];

  // Prepare yearly breakdown data for stacked bar chart
  const yearlyData = emiData ? (() => {
    const years = [];
    const totalMonths = emiData.monthlyData.length;
    const yearsCount = Math.ceil(totalMonths / 12);
    
    for (let year = 1; year <= yearsCount; year++) {
      const startMonth = (year - 1) * 12;
      const endMonth = Math.min(year * 12, totalMonths);
      
      let yearlyPrincipal = 0;
      let yearlyInterest = 0;
      
      for (let i = startMonth; i < endMonth; i++) {
        yearlyPrincipal += emiData.monthlyData[i].principal;
        yearlyInterest += emiData.monthlyData[i].interest;
      }
      
      years.push({
        year: `Year ${year}`,
        principal: yearlyPrincipal,
        interest: yearlyInterest,
        total: yearlyPrincipal + yearlyInterest
      });
    }
    
    return years;
  })() : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-8 sm:mb-12 text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400"
        >
          EMI Calculator + Amortization Schedule
        </motion.h1>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Column - Input Form */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-white/20 shadow-2xl"
          >
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-white">Loan Details</h2>
            
            {/* Loan Amount */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-white mb-2 sm:mb-3 font-medium text-sm sm:text-base">Loan Amount (₹)</label>
              <div className="relative">
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-300 text-sm sm:text-base"
                />
                <div className="mt-4 relative">
                  <input
                    type="range"
                    min="10000"
                    max="10000000"
                    step="1000"
                    value={loanAmount}
                    onChange={handleLoanAmountChange}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider-modern loan-slider"
                    style={{
                      background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(loanAmount - 10000) / (10000000 - 10000) * 100}%, rgba(255,255,255,0.1) ${(loanAmount - 10000) / (10000000 - 10000) * 100}%, rgba(255,255,255,0.1) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Interest Rate */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-white mb-2 sm:mb-3 font-medium text-sm sm:text-base">Annual Interest Rate (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  step="0.1"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-300 text-sm sm:text-base"
                />
                <div className="mt-4 relative">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.1"
                    value={interestRate}
                    onChange={handleInterestRateChange}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider-modern interest-slider"
                    style={{
                      background: `linear-gradient(to right, #f97316 0%, #f97316 ${((interestRate - 1) / (20 - 1)) * 100}%, rgba(255,255,255,0.1) ${((interestRate - 1) / (20 - 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Tenure */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-white mb-2 sm:mb-3 font-medium text-sm sm:text-base">Tenure (Years)</label>
              <div className="relative">
                <input
                  type="number"
                  value={tenure}
                  onChange={(e) => setTenure(Number(e.target.value))}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-300 text-sm sm:text-base"
                />
                <div className="mt-4 relative">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={tenure}
                    onChange={handleTenureChange}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider-modern tenure-slider"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${((tenure - 1) / (30 - 1)) * 100}%, rgba(255,255,255,0.1) ${((tenure - 1) / (30 - 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Additional Months */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-white mb-2 sm:mb-3 font-medium text-sm sm:text-base">Additional Months</label>
              <div className="relative">
                <input
                  type="number"
                  value={additionalMonths}
                  onChange={(e) => setAdditionalMonths(Number(e.target.value))}
                  min="0"
                  max="60"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-300 text-sm sm:text-base"
                />
                <div className="mt-4 relative">
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={additionalMonths}
                    onChange={handleAdditionalMonthsChange}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider-modern months-slider"
                    style={{
                      background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(additionalMonths / 60) * 100}%, rgba(255,255,255,0.1) ${(additionalMonths / 60) * 100}%, rgba(255,255,255,0.1) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Start Date */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-white mb-2 sm:mb-3 font-medium text-sm sm:text-base">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-300 text-sm sm:text-base"
              />
            </div>

            {/* Payment Frequency */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-white mb-2 sm:mb-3 font-medium text-sm sm:text-base">Payment Frequency</label>
              <select
                value={paymentFrequency}
                onChange={(e) => setPaymentFrequency(e.target.value as 'monthly' | 'quarterly' | 'half-yearly')}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-300 text-sm sm:text-base"
              >
                <option value="monthly" className="bg-gray-800">Monthly</option>
                <option value="quarterly" className="bg-gray-800">Quarterly</option>
                <option value="half-yearly" className="bg-gray-800">Half-yearly</option>
              </select>
            </div>
          </motion.div>

          {/* Right Column - Visualizations */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Results Summary */}
            {emiData && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-center">
                  <div>
                    <p className="text-white/70 text-sm mb-1">
                      {paymentFrequency === 'monthly' ? 'EMI' : 
                       paymentFrequency === 'quarterly' ? 'EQI' : 'EHI'}
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-white">₹{emiData.emi.toFixed(2)}</p>
                    <p className="text-white/50 text-xs mt-1">
                      {paymentFrequency === 'monthly' ? 'per month' : 
                       paymentFrequency === 'quarterly' ? 'per quarter' : 'per half-year'}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm mb-1">Total Interest</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">₹{emiData.totalInterest.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm mb-1">Total Payment</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">₹{emiData.totalPayment.toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3D Donut Chart - Hero Visual */}
            {emiData && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl"
                style={{ filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.2))' }}
              >
                <h3 className="text-xl font-semibold mb-4 text-white">Principal vs Interest</h3>
                <Custom3DDonut data={pieData} />
              </motion.div>
            )}

            {/* Gradient Area Chart - Growth Visual */}
            {emiData && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl"
                style={{ filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.2))' }}
              >
                <h3 className="text-xl font-semibold mb-4 text-white">Loan Balance Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={lineData}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.6}/>
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="month" 
                      stroke="rgba(255,255,255,0.5)" 
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.5)" 
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fill="url(#balanceGradient)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="principal" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fill="url(#principalGradient)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="interest" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      fill="url(#interestGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Stacked Bar Chart - Yearly Breakdown */}
            {emiData && yearlyData.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl"
                style={{ filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.2))' }}
              >
                <h3 className="text-xl font-semibold mb-4 text-white">Yearly Payment Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={yearlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="year" 
                      stroke="rgba(255,255,255,0.5)" 
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.5)" 
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="interest" stackId="a" fill="#f97316" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="principal" stackId="a" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Calculate Button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCalculateFullSchedule}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20"
          >
            Calculate Full Schedule
          </motion.button>
        </motion.div>

        {/* Contact Form - Only shown after Calculate button */}
        <AnimatePresence>
          {showLeadForm && !showSchedule && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <motion.div 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl max-w-4xl mx-auto"
              >
                <h3 className="text-2xl sm:text-3xl font-semibold mb-6 sm:mb-8 text-white text-center">Contact Us for Your Loan Requirements</h3>
                <form onSubmit={handleLeadSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-white mb-2 font-medium text-sm sm:text-base">Name *</label>
                      <input
                        type="text"
                        value={leadForm.name}
                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm text-sm sm:text-base"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-white mb-2 font-medium text-sm sm:text-base">Email *</label>
                      <input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm text-sm sm:text-base"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-white mb-2 font-medium text-sm sm:text-base">Phone</label>
                      <input
                        type="tel"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-white mb-2 font-medium text-sm sm:text-base">Service *</label>
                      <select
                        value={leadForm.service}
                        onChange={(e) => setLeadForm({ ...leadForm, service: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm text-sm sm:text-base"
                        required
                      >
                        <option value="" className="bg-gray-800">Select a service</option>
                        <option value="home" className="bg-gray-800">Home Loan</option>
                        <option value="personal" className="bg-gray-800">Personal Loan</option>
                        <option value="car" className="bg-gray-800">Car Loan</option>
                        <option value="business" className="bg-gray-800">Business Loan</option>
                        <option value="other" className="bg-gray-800">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-white mb-2 font-medium text-sm sm:text-base">Message</label>
                    <textarea
                      value={leadForm.message}
                      onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })}
                      rows={4}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm text-sm sm:text-base resize-none"
                      placeholder="Tell us about your requirements..."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold text-base sm:text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg border border-white/20"
                    >
                      Submit Contact Form
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Amortization Schedule */}
        <AnimatePresence>
          {showSchedule && emiData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <motion.div 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Amortization Schedule</h3>
                    <p className="text-white/70 text-sm mt-1">
                      Showing: <span className="font-medium capitalize">{paymentFrequency}</span> payments
                      {paymentFrequency !== 'monthly' && ' (Monthly breakdown available in PDF)'}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePrintToPDF}
                    className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20"
                  >
                    Print to PDF
                  </motion.button>
                </div>
                
                <div id="amortization-schedule" className="overflow-x-auto">
                  <table className="w-full text-white">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-3 px-4">#</th>
                        <th className="text-left py-3 px-4">Date</th>
                        <th className="text-right py-3 px-4">Payment</th>
                        <th className="text-right py-3 px-4">Principal</th>
                        <th className="text-right py-3 px-4">Interest</th>
                        <th className="text-right py-3 px-4">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paymentFrequency === 'monthly' ? emiData.monthlyData : emiData.frequencyData).map((data, index) => (
                        <tr key={index} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4">{index + 1}</td>
                          <td className="py-3 px-4">{data.date.toLocaleDateString('en-GB')}</td>
                          <td className="text-right py-3 px-4">₹{emiData.emi.toFixed(2)}</td>
                          <td className="text-right py-3 px-4">₹{data.principal.toFixed(2)}</td>
                          <td className="text-right py-3 px-4">₹{data.interest.toFixed(2)}</td>
                          <td className="text-right py-3 px-4">₹{data.balance.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
