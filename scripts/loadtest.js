import http from 'k6/http';
import {check,sleep} from 'k6';
export const options={vus:20,duration:'1m',thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<1000']}};
export default function() {
  const base=__ENV.BASE_URL||'http://localhost:8090';
  check(http.get(base+'/api/venues?page=0&size=20'),{'venues respond 200':r=>r.status===200});
  if(__ENV.HALL_ID) check(http.get(base+'/api/halls/'+__ENV.HALL_ID+'/availability?month='+(__ENV.MONTH||'2026-12')),{'availability responds 200':r=>r.status===200});
  sleep(1);
}
