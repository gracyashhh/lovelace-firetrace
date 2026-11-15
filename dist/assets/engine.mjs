export function predict(models,input){
 const heptane=input.fuel==='Heptane'?1:0;
 const x={...input,diameter_squared:input.diameter**2,oxygen_partial_pressure:input.pressure*input.oxygen,heptane_oxygen:heptane*input.oxygen,heptane_co2:heptane*input.co2,heptane_helium:heptane*input.helium,heptane_diameter_squared:heptane*input.diameter**2};
 const result={};
 for(const [key,m] of Object.entries(models)){
 let v=[...m.categories.map(c=>+(c===x.fuel)),...m.numeric.map((n,i)=>(x[n]-m.mean[i])/m.scale[i])];
 if(m.trees){v=v.map(Math.fround);let sum=null;for(const t of m.trees){let i=0;while(t.left[i]!==-1)i=v[t.feature[i]]<=t.threshold[i]?t.left[i]:t.right[i];let a=t.value[i];if(m.classes){let total=a.reduce((a,b)=>a+b,0);a=a.map(z=>z/total);}if(!sum)sum=a.map(()=>0);a.forEach((a,i)=>sum[i]+=a/m.trees.length);}if(m.classes){result[key]=m.classes[sum.indexOf(Math.max(...sum))];result.probabilities=Object.fromEntries(m.classes.map((c,i)=>[c,sum[i]]));}else result[key]=sum[0];
 }else result[key]=m.intercept+v.reduce((s,a,i)=>s+a*m.coef[i],0);
 }return result;
}
