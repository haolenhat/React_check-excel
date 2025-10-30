import React from 'react'
import { ExcelTable } from './components/ExcelTable'

function App(): JSX.Element {
	return (
		<div className="app">
			<h1>Data Mirinda</h1>
			<p className="subtitle">Nhập file Excel (.xlsx, .xls) và xem kết quả</p>
			<ExcelTable />
		</div>
	)
}

export default App



