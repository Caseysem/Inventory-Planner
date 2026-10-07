import sys,json,math
import numpy as np
from scipy.optimize import milp,Bounds,LinearConstraint
from scipy.sparse import csc_array
parts=json.load(sys.stdin);whole=0;counts={}
for p in parts:
 q=int(p['qty']);y=float(p.get('yield') or 1);u=math.floor(y);whole+=q*u;f=round(y-u,10)
 if f>1e-9:counts[f]=counts.get(f,0)+q
sizes=sorted(counts,reverse=True);need=[counts[s] for s in sizes];patterns=[];work=0
# Enumerate possible sheet patterns by piece type, rather than individual pieces.
def expand(index,space,pattern):
 global work
 work+=1
 if work>250000:raise ValueError('Too many allocation patterns')
 if index==len(sizes):
  if any(pattern):patterns.append(pattern)
  return
 for n in range(min(need[index],math.floor((space+1e-9)/sizes[index]))+1):
  expand(index+1,space-n*sizes[index],pattern+[n])
try:
 expand(0,1,[])
 if len(patterns)>50000:raise ValueError('Too many allocation patterns')
 a=csc_array(np.array(patterns,dtype=float).T)
 result=milp(c=np.ones(len(patterns)),integrality=np.ones(len(patterns)),bounds=Bounds(0,np.inf),constraints=LinearConstraint(a,need,need),options={'time_limit':15,'mip_rel_gap':0})
 if result.status!=0:raise ValueError('Optimal allocation not verified')
 solution=np.rint(result.x).astype(int)
 if not np.array_equal(np.array(patterns,dtype=int).T@solution,np.array(need)):raise ValueError('Allocation verification failed')
 print(json.dumps({'qty':whole+int(sum(solution))}))
except Exception as e:print(json.dumps({'error':'Sheet allocation needs review: '+str(e)}))
