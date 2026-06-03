import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
// Muat master di awal: menyinkronkan daftar cabang tersimpan (master.branches)
// ke konstanta BRANCHES yang dipakai seluruh app, sebelum layar apa pun render.
import './store/master.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
