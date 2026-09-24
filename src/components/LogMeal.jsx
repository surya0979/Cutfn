import { PenLine, ScanLine, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { dayInline } from '../lib/labels.js'
import ManualEntry from './ManualEntry.jsx'
import MenuScanner from './MenuScanner.jsx'
import { Card, CardHeader, TabPanel, Tabs } from './ui.jsx'

export default function LogMeal({ onAdd, recentFoods, dayLabel }) {
  const [tab, setTab] = useState('manual')
  const [prefill, setPrefill] = useState(null)

  return (
    <Card id="food">
      <CardHeader icon={UtensilsCrossed} title="Log a meal" subtitle={`Adding to ${dayInline(dayLabel)}`} />
      <Tabs
        label="How to log"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'manual', label: 'Manual', icon: PenLine },
          { value: 'scan', label: 'Scan menu', icon: ScanLine },
        ]}
      />
      {/* Keep both mounted so a scan in progress survives a tab switch. */}
      <div hidden={tab !== 'manual'}>
        <TabPanel value="manual">
          <ManualEntry onAdd={onAdd} recentFoods={recentFoods} prefill={prefill} />
        </TabPanel>
      </div>
      <div hidden={tab !== 'scan'}>
        <TabPanel value="scan">
          <MenuScanner
            onAdd={onAdd}
            onManual={(name) => {
              setPrefill({ name, at: Date.now() })
              setTab('manual')
            }}
          />
        </TabPanel>
      </div>
    </Card>
  )
}
