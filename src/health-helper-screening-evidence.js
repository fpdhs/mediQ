// Fixed Korean editorial candidates for scenario screening topics. Not a diagnosis system.
import {readFile} from 'node:fs/promises';
import {POLICY,retrieveScenarioEvidence} from './health-helper-scenario-evidence.js';
import {sha256} from './health-helper-medlineplus.js';
import {sourceSectionsExist} from './health-helper-source-sections.js';

const base='https://medlineplus.gov/lab-tests/';
const urls=Object.freeze({
 obesity:`${base}obesity-screening/`,bloodPressure:`${base}measuring-blood-pressure/`,vision:`${base}vision-screening/`,
 hearing:`${base}hearing-tests-for-adults/`,hemoglobin:`${base}hemoglobin-test/`,glucose:`${base}blood-glucose-test/`,
 creatinine:`${base}creatinine-test/`,egfr:`${base}estimated-glomerular-filtration-rate-egfr-and-gfr-tests/`,
 urineProtein:`${base}protein-in-urine/`,cholesterol:`${base}cholesterol-levels/`,triglycerides:`${base}triglycerides-test/`,
 hepatitis:`${base}hepatitis-testing/`,lung:`${base}lung-function-tests/`,chestXray:'https://medlineplus.gov/xrays.html',
 dental:`${base}dental-exam/`,labResults:`${base}how-to-understand-your-lab-results/`,
 imagingRecord:'https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication',
 fdaPolicy:'https://www.fda.gov/about-fda/about-website/website-policies',
});

const labCompare={url:urls.labResults,section:'What is a reference range? · What can affect my results?',
 text:'검사실마다 검사 방법·참고범위·단위가 다를 수 있어 서로 다른 검사실의 수치를 바로 비교하지 않는 것이 좋습니다. 보고서의 검사명, 검사일, 기관, 단위와 참고범위를 확인하고, 시간에 따른 추세는 가능하면 같은 검사실 결과로 의료진과 살펴보세요. 이 안내는 수치 차이를 계산하거나 진단하지 않습니다.',
 question:'이전 결과와 비교할 때 검사일·기관·단위가 같은지 확인해야 하나요?',comparisonBasis:'MEDLINEPLUS_LAB_COMPARISON'};
const recordCompare={url:urls.imagingRecord,section:'Patient Medical Imaging Record Card',
 text:'이전 영상검사의 날짜·종류·촬영 기관을 정리하면 환자와 의료진이 영상 이력을 논의하는 데 도움이 됩니다. 과거와 현재 영상을 직접 비교할 수 있는지는 담당 의료진에게 확인하세요. 이 안내는 영상을 자동 비교하거나 소견을 판독하지 않습니다.',
 question:'이전 검사 날짜·종류·촬영 기관을 이번 진료에서 함께 확인할 수 있을까요?',comparisonBasis:'FDA_IMAGING_RECORD_GUIDANCE'};
const L=(section,text,question,url)=>({url,section,text,question,comparisonBasis:'MEDLINEPLUS_TEST_INFORMATION'});
const T=(key,label,aliases,source,details)=>({key,label,aliases,source,details});

export const screeningTopics=Object.freeze([
 T('height','키',['키','키 측정'],urls.obesity,{
  PURPOSE:L('How is a BMI calculated?','키는 체중과 함께 체질량지수(BMI)를 계산하는 데 사용됩니다. 이 선별검사는 체중 관련 위험을 살피는 한 방법입니다.','키 측정은 건강검진에서 어떤 정보를 제공하나요?',urls.obesity),
  LIMITS:L('How is a BMI calculated?','키 단독으로 체지방량이나 건강 상태를 판단할 수 없습니다. BMI도 체지방을 직접 측정하지 않는 추정 지표입니다.','키 측정만으로 알 수 없는 점은 무엇인가요?',urls.obesity),
  PREPARATION:L('Will I need to do anything to prepare for an obesity screening?','키·체중을 이용한 비만 선별검사 자체에는 특별한 준비가 필요하지 않습니다. 함께 하는 혈액검사가 있다면 별도 금식 지침이 있을 수 있으니 검사기관에 확인하세요.','이번 건강검진에서 키 측정 외에 별도 금식 준비가 있나요?',urls.obesity),
  COMPARISON:L('What is obesity screening? · Why do I need obesity screening?','체중 관련 추세를 볼 때는 측정 날짜와 키·체중·BMI 항목을 구분해 확인하세요. MedlinePlus는 BMI 변화를 시간에 따라 살필 수 있다고 설명하지만, 키만으로 체중 변화를 해석하지는 않습니다. 이 후보는 기록을 자동 계산하거나 진단하지 않습니다.','이전 키 기록을 다시 볼 때 어떤 조건을 확인하나요?',urls.obesity)}),
 T('weight','체중',['체중','몸무게'],urls.obesity,{
  PURPOSE:L('What is obesity screening? · How is a BMI calculated?','체중은 키와 함께 BMI를 계산해 체중 관련 위험을 선별하는 데 활용됩니다. 몸무게 자체는 체지방만을 뜻하지 않습니다.','체중 측정은 건강검진에서 어떤 목적으로 확인하나요?',urls.obesity),
  LIMITS:L('What is obesity screening? · How is a BMI calculated?','체중에는 지방뿐 아니라 근육·뼈·수분도 반영될 수 있습니다. BMI도 체지방을 직접 측정하거나 지방이 몸의 어디에 있는지 보여주는 검사는 아닙니다.','체중만으로 판단할 수 없는 점은 무엇인가요?',urls.obesity),
  PREPARATION:L('Will I need to do anything to prepare for an obesity screening?','체중 측정이 포함된 비만 선별검사에는 특별한 준비가 필요하지 않습니다. 함께 하는 혈액검사 준비는 다를 수 있으므로 해당 검사기관의 안내를 따르세요.','체중 측정 전에 특별히 준비할 것이 있나요?',urls.obesity),
  COMPARISON:L('Why do I need obesity screening? · How is a BMI calculated?','체중 변화를 볼 때는 측정 날짜와 단위를 확인하고, 체중과 BMI를 서로 다른 항목으로 살펴보세요. BMI는 키와 체중으로 계산한 추정치이지 체지방의 직접 측정값은 아닙니다. 이 후보는 개인 변화량을 계산하지 않습니다.','이전 체중 기록과 비교할 때 어떤 조건을 확인하나요?',urls.obesity)}),
 T('waist','허리둘레',['허리둘레','허리 둘레'],urls.obesity,{
  PURPOSE:L('What is obesity screening? · What happens during an obesity screening?','허리둘레는 복부에 지방이 얼마나 모였는지 살피는 데 사용할 수 있는 추가 측정입니다. 의료진은 BMI와 함께 체중 관련 위험을 평가할 때 참고할 수 있습니다.','허리둘레 측정은 어떤 목적으로 활용되나요?',urls.obesity),
  LIMITS:L('What happens during an obesity screening?','허리둘레 하나만으로 질환을 진단하거나 체지방을 정확히 측정할 수는 없습니다. 이 측정은 다른 건강 정보와 함께 해석해야 합니다.','허리둘레만으로 알 수 없는 점은 무엇인가요?',urls.obesity),
  PREPARATION:L('Will I need to do anything to prepare for an obesity screening?','허리둘레 측정이 포함된 비만 선별검사에는 특별한 준비가 필요하지 않습니다. 측정 방법은 검사하는 의료진의 안내를 따르세요.','허리둘레 측정 전에 특별히 준비할 것이 있나요?',urls.obesity),
  COMPARISON:L('What happens during an obesity screening? · Why do I need obesity screening?','이전 허리둘레 기록과 비교할 때는 측정 날짜·단위와 검사기관의 측정 방법을 함께 확인하세요. BMI와 허리둘레는 서로 다른 측정이므로 하나를 다른 하나의 변화로 대신하지 않습니다. 이 비교 체크리스트는 프로젝트 안내이며 수치를 해석하지 않습니다.','이전 허리둘레 기록을 다시 볼 때 측정 조건을 확인해야 하나요?',urls.obesity)}),
 T('bmi','체질량지수',['체질량지수','BMI'],urls.obesity,{
  PURPOSE:L('How is a BMI calculated? · What is an obesity screening used for?','BMI는 성인의 키와 체중으로 계산하는 지수이며 체중 관련 위험을 선별할 때 활용됩니다.','BMI는 무엇을 계산하며 검진에서 왜 확인하나요?',urls.obesity),
  LIMITS:L('How is a BMI calculated?','BMI는 체지방을 직접 측정하지 않고 지방과 근육을 구분하지 못합니다. 지방이 몸의 어디에 분포하는지도 보여주지 않으므로 BMI만으로 개인의 건강 상태를 판단할 수 없습니다.','BMI만으로 판단할 수 없는 신체 정보는 무엇인가요?',urls.obesity),
  PREPARATION:L('Will I need to do anything to prepare for an obesity screening?','BMI 계산에 쓰는 키·체중 측정에는 특별한 준비가 필요하지 않습니다. 함께 하는 혈액검사가 있다면 금식 등 별도 안내를 확인하세요.','BMI 확인과 함께 받는 검사에 별도 준비가 필요한가요?',urls.obesity),
  COMPARISON:L('Why do I need obesity screening? · How is a BMI calculated?','BMI 추세를 볼 때는 계산에 사용한 키·체중과 기록 날짜를 확인하세요. MedlinePlus는 BMI 변화를 시간에 따라 살필 수 있다고 설명하지만, BMI는 체지방을 직접 측정하지 않습니다. 이 후보는 수치 차이나 질환 여부를 판단하지 않습니다.','BMI 추세를 다시 볼 때 어떤 기록 조건을 확인하나요?',urls.obesity)}),
 T('blood-pressure','혈압',['혈압','혈압 측정'],urls.bloodPressure,{
  PURPOSE:L('What is a blood pressure measurement? · What is it used for?','혈압 측정은 심장이 뛸 때 동맥에 가해지는 압력을 확인하며, 주로 고혈압을 진단하는 데 사용됩니다.','혈압 측정에서 확인하는 두 값과 검사 목적은 무엇인가요?',urls.bloodPressure),
  LIMITS:L('What do the results mean?','혈압은 오르내릴 수 있어 한 번의 측정만으로 고혈압을 확정하지 않습니다. MedlinePlus는 보통 서로 다른 날의 여러 측정과 병력·증상 등을 함께 고려한다고 안내합니다.','한 번의 혈압 측정만으로 판단할 수 없는 점은 무엇인가요?',urls.bloodPressure),
  PREPARATION:L('Will I need to do anything to prepare for the test?','보다 정확한 측정을 위해 검사 전 삼십 분 동안 운동·음주·흡연·카페인을 피하고 화장실을 다녀오도록 안내합니다. 복용 중인 약은 의료진에게 알리고, 실제 준비는 검사기관 지침을 따르세요.','혈압 측정 전에 따라야 할 준비 안내는 무엇인가요?',urls.bloodPressure),
  COMPARISON:L('What do the results mean? · Will I need to do anything to prepare for the test?','혈압은 변동될 수 있으므로 이전 기록과 비교할 때 날짜별 수축기·이완기 값, 측정 기관과 당시 측정 조건을 함께 확인하세요. 진단은 여러 날의 측정과 의료진의 종합 판단에 따릅니다. 이 후보는 고혈압 여부를 판정하지 않습니다.','이전 혈압 기록의 날짜·두 측정값·측정 조건을 함께 볼 수 있나요?',urls.bloodPressure)}),
 T('vision','시력',['시력','시력 검사'],urls.vision,{
  PURPOSE:L('What is vision screening? · What is it used for?','시력 선별검사는 가까운 곳과 먼 곳을 얼마나 잘 보는지 확인하고, 필요하면 더 종합적인 눈 검사를 안내하는 데 쓰입니다.','시력 선별검사는 어떤 정보를 확인하나요?',urls.vision),
  LIMITS:L('What is vision screening?','시력 선별검사는 일부 흔한 시력 문제를 찾을 수 있지만 다른 눈 질환은 놓칠 수 있습니다. 선별 결과만으로 전체 눈 건강을 판단하지 않으며, 필요한 종합 검사는 안과 전문인에게 확인하세요.','시력 선별검사만으로 알 수 없는 눈 건강 정보는 무엇인가요?',urls.vision),
  PREPARATION:L('Will I need to do anything to prepare for vision screening?','안경이나 콘택트렌즈를 사용한다면 시력 선별검사에 가져오세요. 검사자가 시력 교정 상태를 확인할 수 있습니다.','시력 검사 준비로 안경이나 콘택트렌즈를 가져가야 하나요?',urls.vision),
  COMPARISON:{...L('What is vision screening? · Will I need to do anything to prepare for vision screening?','이전 시력 기록과 비교할 때는 검사일, 검사 종류, 좌·우 눈 구분과 안경·렌즈 착용 여부를 함께 확인하세요. 이 항목은 프로젝트가 만든 진료 준비 체크리스트이며, 시력 결과를 자동 비교하거나 진단하지 않습니다.','이전과 이번 시력 검사에서 검사 종류와 교정렌즈 조건이 같나요?',urls.vision),comparisonBasis:'PROJECT_COMPARISON_CHECKLIST'} }),
 T('hearing','청력',['청력','청력 검사'],urls.hearing,{
  PURPOSE:L('What are hearing tests? · What are they used for?','청력검사는 소리를 얼마나 잘 듣는지 확인하고, 청력 저하가 있다면 정도와 유형, 어느 귀가 더 영향을 받았는지 살피는 데 쓰입니다.','청력검사는 어떤 정보를 확인하나요?',urls.hearing),
  LIMITS:L('What do the results mean?','청력검사 결과가 청력 저하의 원인을 항상 확정하는 것은 아닙니다. MedlinePlus는 경우에 따라 원인을 진단하기 위해 추가 검사가 필요할 수 있다고 안내합니다.','청력검사 결과만으로 알 수 없는 원인은 무엇인가요?',urls.hearing),
  PREPARATION:L('Will I need to do anything to prepare for a hearing test?','청력검사에는 특별한 준비가 필요하지 않다고 안내되어 있습니다. 보청기나 과거 청력 수술·검사 정보가 있다면 검사기관에 지참 필요 여부를 확인하세요.','청력검사 전에 특별히 준비할 것이 있나요?',urls.hearing),
  COMPARISON:{...L('What are hearing tests? · What do the results mean?','이전 청력 결과와 비교하려면 검사일·검사 종류·좌우 귀와 결과 보고서를 함께 확인하세요. 검사법이 다를 수 있으므로 직접 추세 해석은 담당 청각·의료 전문가에게 맡기며, 이 후보는 청력도를 분석하지 않습니다.','이전과 이번 청력검사의 종류와 좌우 귀 기록을 함께 검토할 수 있나요?',urls.hearing),comparisonBasis:'PROJECT_COMPARISON_CHECKLIST'} }),
 T('hemoglobin','혈색소',['혈색소','헤모글로빈','Hb'],urls.hemoglobin,{
  PURPOSE:L('What is a Hemoglobin Test? · What is it used for?','혈색소는 적혈구에서 산소를 운반하는 단백질이며, 혈색소 검사는 혈액 속 양을 측정해 빈혈 등을 확인하는 데 사용됩니다. 보통 전혈구검사의 일부로 측정됩니다.','혈색소 검사는 무엇을 측정하고 왜 하나요?',urls.hemoglobin),
  LIMITS:L('What do the results mean?','혈색소 수치가 높거나 낮은 원인은 여러 가지이며, 이 검사만으로 원인을 알 수 없습니다. 참고범위는 검사실과 개인 특성에 따라 다를 수 있습니다.','혈색소 검사만으로 수치 변화의 원인을 알 수 있나요?',urls.hemoglobin),
  PREPARATION:L('Will I need to do anything to prepare for the test?','혈색소 검사 자체에는 특별한 준비가 필요하지 않습니다. 다른 혈액검사를 함께 받으면 금식이 필요할 수 있으므로 검사기관 안내를 확인하세요.','혈색소와 함께 받는 검사 때문에 금식이 필요한가요?',urls.hemoglobin),
  COMPARISON:labCompare}),
 T('fasting-glucose','공복혈당',['공복혈당','공복 혈당','혈당','혈당검사'],urls.glucose,{
  PURPOSE:L('What is a blood glucose test? · What is it used for?','혈당검사는 혈액 속 포도당을 측정하며, 검진에서 당뇨병 전단계나 당뇨병 선별에 사용될 수 있습니다. 공복 검사는 여러 혈당 검사 유형 중 하나입니다.','공복혈당 검사의 목적은 무엇인가요?',urls.glucose),
  LIMITS:L('What do the results mean?','혈당 결과 의미는 어떤 유형의 검사를 했는지, 다른 검사 결과와 건강 이력에 따라 달라집니다. 공복 여부가 다른 검사의 결과를 같은 조건으로 간주하지 마세요.','공복혈당 결과만으로 판단할 수 없는 점은 무엇인가요?',urls.glucose),
  PREPARATION:L('Will I need to do anything to prepare for the test?','공복혈당 검사라면 MedlinePlus는 검사 전 여덟 시간 금식이 필요할 수 있다고 안내합니다. 다만 혈당검사 종류에 따라 준비가 다르므로 이번 검사가 공복검사인지, 금식 시간을 검사기관에 확인하세요.','공복혈당 검사 전 금식 시간은 어떻게 확인하나요?',urls.glucose),
  COMPARISON:labCompare}),
 T('creatinine','혈청 크레아티닌',['혈청 크레아티닌','크레아티닌'],urls.creatinine,{
  PURPOSE:L('What is a creatinine test? · What is it used for?','크레아티닌은 근육 활동으로 생기는 노폐물이며, 혈청 크레아티닌 검사는 신장 상태를 살피고 알려진 신장 문제나 일부 약물 영향을 확인하는 데 사용될 수 있습니다.','혈청 크레아티닌은 무엇을 확인하는 검사인가요?',urls.creatinine),
  LIMITS:L('What is it used for? · What do the results mean?','크레아티닌 단독 검사는 신장이 얼마나 잘 작동하는지 평가하는 가장 좋은 방법은 아닙니다. 근육량·식사·나이·활동도 등이 영향을 줄 수 있고, 정상 결과도 초기 신장 문제를 항상 배제하지 않습니다.','크레아티닌만으로 신장 상태를 판단하기 어려운 이유는 무엇인가요?',urls.creatinine),
  PREPARATION:L('Will I need to do anything to prepare for the test?','준비는 검사 종류에 따라 다릅니다. 식사나 약·보충제가 영향을 줄 수 있으므로 검사기관 안내를 확인하고, 의료진 지시 없이 약을 중단하지 마세요.','혈청 크레아티닌 검사 전에 식사 제한이 필요한가요?',urls.creatinine),
  COMPARISON:labCompare}),
 T('egfr','신장기능 eGFR',['신장기능 eGFR','eGFR','사구체여과율'],urls.egfr,{
  PURPOSE:L('What are estimated glomerular filtration rate (eGFR) and GFR tests?','eGFR은 신장이 혈액 속 노폐물을 걸러내는 정도를 추정하는 값입니다. 선별·평가·경과 확인에 쓰이며 혈청 크레아티닌으로 계산되는 경우가 많습니다.','eGFR은 무엇을 추정하고 신장 검사에서 왜 활용하나요?',urls.egfr),
  LIMITS:L('What do the results mean?','eGFR은 완벽한 검사가 아니며 항상 신장 손상을 반영하지는 않습니다. 나이·체격·다른 건강 상태 등에 따라 달라질 수 있어 숫자 하나만으로 진단하지 않습니다.','eGFR 하나만으로 신장 상태를 모두 알 수 있나요?',urls.egfr),
  PREPARATION:L('Will I need to do anything to prepare for these tests?','eGFR 검사 전 금식이나 특정 음식 제한이 필요할 수 있고, 약도 결과에 영향을 줄 수 있습니다. 실제 지침을 검사기관에 확인하고 의료진 지시 없이 약을 중단하지 마세요.','이번 eGFR 검사에 금식이나 음식 제한이 필요한가요?',urls.egfr),
  COMPARISON:labCompare}),
 T('urine-protein','요단백',['요단백','소변 단백','단백뇨'],urls.urineProtein,{
  PURPOSE:L('What is a protein in urine test? · What is it used for?','요단백 검사는 소변의 단백질 양을 확인하며, 일반 소변검사의 일부이거나 신장 문제를 살피고 경과를 확인하는 데 사용될 수 있습니다.','요단백 검사는 무엇을 확인하나요?',urls.urineProtein),
  LIMITS:L('What do the results mean?','요단백이 많이 검출되어도 일시적인 운동·탈수·식사·스트레스 등의 영향일 수 있습니다. 지속 여부와 원인은 추가 검사와 의료진 평가가 필요할 수 있습니다.','요단백 결과 하나만으로 원인을 판단하기 어려운 이유는 무엇인가요?',urls.urineProtein),
  PREPARATION:L('Will I need to do anything to prepare for the test?','일반 요단백 검사에는 특별한 준비가 필요하지 않습니다. 하루 동안 소변을 모으는 검사라면 채취·보관 방법이 따로 있으므로 검사기관의 지침을 따르세요.','하루 동안 소변을 모으는 요단백 검사 전에 어떻게 준비하나요?',urls.urineProtein),
  COMPARISON:labCompare}),
 T('total-cholesterol','총콜레스테롤',['총콜레스테롤','총 콜레스테롤'],urls.cholesterol,{
  PURPOSE:L('What is it used for?','총콜레스테롤은 혈액 속 전체 콜레스테롤 양으로 HDL과 LDL 등을 포함합니다. 지질검사는 심장질환 위험 정보를 얻는 데 사용됩니다.','총콜레스테롤 검사의 목적은 무엇인가요?',urls.cholesterol),
  LIMITS:L('What do the results mean?','총콜레스테롤 하나만으로 개인의 심장질환 여부나 위험을 확정할 수 없습니다. HDL·LDL·중성지방, 나이·가족력·생활습관 등과 함께 의료진이 살펴야 합니다.','총콜레스테롤만으로 판단할 수 없는 점은 무엇인가요?',urls.cholesterol),
  PREPARATION:L('Will I need to do anything to prepare for the test?','콜레스테롤 혈액검사는 금식이 필요할 수 있지만 모든 경우에 같은 것은 아닙니다. 금식 여부와 시간은 검사기관 지침을 확인하세요.','총콜레스테롤 검사 전에는 어떻게 준비하나요?',urls.cholesterol),
  COMPARISON:labCompare}),
 T('hdl','HDL 콜레스테롤',['HDL 콜레스테롤','HDL'],urls.cholesterol,{
  PURPOSE:L('What is it used for?','HDL은 지질검사의 한 항목이며, MedlinePlus는 HDL이 혈액에서 LDL을 제거하는 데 도움을 준다고 설명합니다. 결과는 다른 지질 수치와 함께 살펴봅니다.','HDL은 지질검사에서 어떤 역할을 하는 항목인가요?',urls.cholesterol),
  LIMITS:L('What do the results mean?','HDL 하나만으로 심장질환 여부를 확정할 수 없습니다. HDL의 의미는 LDL·총콜레스테롤·중성지방과 다른 위험 요인을 함께 고려해 의료진에게 확인해야 합니다.','HDL 결과만으로 알 수 없는 점은 무엇인가요?',urls.cholesterol),
  PREPARATION:L('Will I need to do anything to prepare for the test?','지질검사에는 금식이 필요할 수 있습니다. HDL 항목만 보고 준비를 단정하지 말고 전체 검사 주문과 검사기관의 안내를 확인하세요.','HDL과 함께 받는 전체 지질검사의 금식 지침은 무엇인가요?',urls.cholesterol),
  COMPARISON:labCompare}),
 T('ldl','LDL 콜레스테롤',['LDL 콜레스테롤','LDL'],urls.cholesterol,{
  PURPOSE:L('What is it used for?','LDL은 지질검사의 한 항목입니다. MedlinePlus는 LDL이 동맥의 막힘을 일으키는 침착물의 주요 원천이라고 설명하며, 수치는 전체 지질검사와 함께 살펴봅니다.','LDL은 지질검사에서 왜 확인하나요?',urls.cholesterol),
  LIMITS:L('What do the results mean?','LDL은 혈액에서 직접 측정한 값일 수도 있고 총콜레스테롤·HDL·중성지방으로 계산한 추정값일 수도 있습니다. 검사 방법과 전체 위험 요인을 모른 채 LDL 하나로 진단하지 않습니다.','LDL 결과만으로 단독 해석하기 어려운 이유는 무엇인가요?',urls.cholesterol),
  PREPARATION:L('Will I need to do anything to prepare for the test?','콜레스테롤 검사는 금식이 필요할 수 있습니다. LDL 검사만으로 금식 여부를 정하지 말고 전체 검사와 검사기관의 안내를 확인하세요.','이번 LDL 검사에서 금식이 필요한지 어디서 확인하나요?',urls.cholesterol),
  COMPARISON:labCompare}),
 T('triglycerides','중성지방',['중성지방','트리글리세리드'],urls.triglycerides,{
  PURPOSE:L('What is it used for?','중성지방은 혈액 속 지방의 한 종류이며 보통 지질검사의 일부로 측정됩니다. 결과는 심장·혈관 건강 위험과 치료 경과를 살피는 데 사용될 수 있습니다.','중성지방 검사는 무엇을 확인하나요?',urls.triglycerides),
  LIMITS:L('What is it used for?','중성지방 결과는 LDL·HDL 등 다른 지질 항목과 심혈관 위험 요인을 함께 고려해야 합니다. 이 후보는 수치만으로 개인의 심장질환 위험이나 치료 필요성을 판정하지 않습니다.','중성지방만으로 판단할 수 없는 점은 무엇인가요?',urls.triglycerides),
  PREPARATION:L('Will I need to do anything to prepare for the test?','중성지방 혈액검사는 금식이 필요할 수 있습니다. 금식 시간과 다른 준비는 검사기관의 지침을 확인하세요.','이번 중성지방 검사에 금식이 필요한지 확인했나요?',urls.triglycerides),
  COMPARISON:labCompare}),
 T('hcv-antibody','C형간염 항체',['C형간염 항체','C형 간염 항체','C형간염','C형 간염','HCV 항체'],urls.hepatitis,{
  PURPOSE:L('What is it used for?','간염 혈액검사는 혈액에서 간염의 흔적을 확인하는 데 사용됩니다. C형간염 항체 검사는 과거 감염과 현재 감염을 단독으로 구분하지 못할 수 있어 검사 종류를 함께 확인해야 합니다.','C형간염 항체 검사의 목적은 무엇인가요?',urls.hepatitis),
  LIMITS:L('What is it used for? · What do the results mean?','C형간염 검사는 항체 결과만으로 현재 감염과 과거 감염 후 자연 소실을 구분하지 못합니다. 의심되는 결과는 추가 검사로 확인할 수 있으므로 의료진에게 확인하세요.','C형간염 항체 결과만으로 현재 감염을 확정할 수 없는 이유는 무엇인가요?',urls.hepatitis),
  PREPARATION:L('Will I need to do anything to prepare for the test?','C형간염 검사를 포함한 간염 혈액검사에는 특별한 준비가 필요하지 않다고 안내되어 있습니다. 다른 검사를 함께 받는다면 별도 준비가 있을 수 있으니 확인하세요.','C형간염 항체와 함께 받는 검사에 별도 준비가 있나요?',urls.hepatitis),
  COMPARISON:L('What do the results mean? · What is it used for?','간염 검사 보고 형식은 검사실마다 다를 수 있습니다. 이전 결과와 비교할 때 검사 이름, 항체/항원 종류, 검사일, 기관과 결과 형식을 함께 확인하세요. 항체 결과만으로 현재 감염을 비교·확정하지 않으며 필요한 추가 확인은 의료진에게 문의하세요.','이전과 이번 결과가 같은 C형간염 검사 종류와 보고 형식인가요?',urls.hepatitis)}),
 T('lung-function','폐기능검사',['폐기능검사','폐기능 검사','폐활량검사'],urls.lung,{
  PURPOSE:L('What are lung function tests? · What are they used for?','폐기능검사는 폐가 작동하는 방식을 살피는 여러 검사입니다. 예를 들어 폐활량검사는 내쉬는 공기의 양과 속도를 측정하며, 어떤 검사를 할지는 검사 목적에 따라 달라집니다.','폐기능검사의 목적은 무엇인가요?',urls.lung),
  LIMITS:L('What do the results mean?','폐기능검사 결과는 폐 상태를 살피는 데 도움을 주지만 특정 폐질환을 단독으로 진단하지는 못합니다. 검사 유형과 키·나이·성별 등에 따른 참고 정보를 의료진과 확인해야 합니다.','폐기능검사만으로 특정 질환을 진단할 수 없는 이유는 무엇인가요?',urls.lung),
  PREPARATION:L('Will I need to do anything to prepare for the tests?','검사 전 큰 식사를 피하거나 운동·흡연·음주·카페인을 제한하라는 안내를 받을 수 있습니다. 흡입약 조정이 필요할 수 있어도 의료진 지시 없이 약을 중단하지 말고, 검사기관의 개별 지침을 따르세요.','이번 폐기능검사에서 식사·활동·흡입약 관련 준비를 확인했나요?',urls.lung),
  COMPARISON:{...L('What are lung function tests? · What do the results mean?','폐기능 결과를 비교하려면 폐활량·폐용적·확산능 등 검사 종류와 검사일, 기관, 보고된 조건을 확인하세요. 참고 결과는 키·나이·성별 등에 따라 달라질 수 있습니다. 이 프로젝트 체크리스트는 폐기능 수치를 자동 비교하거나 판독하지 않습니다.','이전과 이번 폐기능검사의 종류와 참고 조건이 같은가요?',urls.lung),comparisonBasis:'PROJECT_COMPARISON_CHECKLIST'} }),
 T('chest-xray','흉부 방사선검사',['흉부 방사선검사','흉부 X선','흉부 엑스레이'],urls.chestXray,{
  PURPOSE:L('Summary · What is an x-ray? · Who needs an x-ray?','흉부 X선은 소량의 방사선으로 가슴 안 구조를 영상으로 만들며, 폐렴 등 일부 문제를 확인하는 데 사용될 수 있습니다. 이번 검사의 질문과 목적은 의뢰한 의료진에게 확인하세요.','이번 흉부 X선은 어떤 진료 질문을 확인하려는 검사인가요?',urls.chestXray),
  LIMITS:L('Summary · What is an x-ray? · What should you expect after an x-ray?','흉부 X선은 영상검사이며 영상의학과 전문의가 이미지를 검토해 담당 의료진에게 결과를 전달합니다. 이 일반 설명은 개인 영상을 판독하거나 모든 질환을 배제하지 않습니다.','흉부 X선 선별검사의 한계는 무엇인가요?',urls.chestXray),
  PREPARATION:L('How do you prepare for an x-ray?','X선 검사는 대체로 준비가 거의 없거나 필요하지 않습니다. 촬영 부위에 따라 장신구 제거 등을 안내받을 수 있고 임신 중이거나 가능성이 있다면 촬영 전 의료진에게 알리세요. 구체적인 지침은 검사기관에 확인하세요.','이번 흉부 X선에서 장신구 제거 등 별도 준비가 있나요?',urls.chestXray),
  COMPARISON:recordCompare}),
 T('dental','구강검진',['구강검진','치과 검진'],urls.dental,{
  PURPOSE:L('What is a dental exam? · What is it used for?','구강검진은 치아와 잇몸을 살펴 충치나 잇몸 질환의 징후를 확인하고 구강 건강 문제를 일찍 찾는 데 사용됩니다. 필요한 경우 치과 X선을 추가할 수 있습니다.','구강검진의 목적은 무엇인가요?',urls.dental),
  LIMITS:L('What is a dental exam? · What do the results mean?','구강검진은 치과 의료진이 살핀 치아·잇몸과 필요한 경우의 X선 소견을 바탕으로 결과를 설명합니다. 이 일반 안내는 개인 구강 상태를 진단하거나 치료 필요성을 정하지 않습니다.','구강검진 결과를 해석할 때 유의할 점은 무엇인가요?',urls.dental),
  PREPARATION:L('Will I need to do anything to prepare for a dental exam?','특정 건강 상태가 있으면 진료 전 항생제가 필요한 경우가 있을 수 있습니다. 심장 문제나 면역계 질환 등이 있다면 치과의사·의료진에게 미리 문의하고, 임신 중이거나 가능성이 있으면 특히 X선 촬영 전에 알리세요.','구강검진을 준비할 때 건강 상태나 임신 가능성을 알려야 하나요?',urls.dental),
  COMPARISON:{...L('What is a dental exam? · What do the results mean?','이전 구강검진을 비교할 때는 검진일, 치과 기관, 치아·잇몸 소견과 치과 X선 촬영 여부를 구분해 이전 기록을 가져가세요. 동일한 항목과 영상 조건인지 의료진에게 확인하며, 이 후보는 치과 기록이나 영상을 자동 판독하지 않습니다.','이전 구강검진 기록과 X선 촬영 여부를 이번 진료에서 함께 볼 수 있나요?',urls.dental),comparisonBasis:'PROJECT_COMPARISON_CHECKLIST'} }),
]);

const intents=Object.freeze(['PURPOSE','LIMITS','PREPARATION','COMPARISON']);
const intentLabels=Object.freeze({PURPOSE:'목적',LIMITS:'한계',PREPARATION:'준비',COMPARISON:'비교 조건'});
export const screeningEvidenceEntries=Object.freeze(screeningTopics.flatMap(topic=>intents.map(intent=>{
 const detail=topic.details[intent];
 const question=detail.comparisonBasis==='MEDLINEPLUS_LAB_COMPARISON'
  ?`${topic.label} 이전 결과와 비교할 때 검사일·기관·단위가 같은지 확인해야 하나요?`
  :detail.comparisonBasis==='FDA_IMAGING_RECORD_GUIDANCE'
   ?`${topic.label} 이전 검사 날짜·종류·촬영 기관을 이번 진료에서 함께 확인할까요?`
   :detail.question;
 return Object.freeze({id:`screening-${topic.key}-${intent.toLowerCase()}`,key:topic.key,label:topic.label,intent,
  url:detail.url,section:detail.section,text:detail.text,question,comparisonBasis:detail.comparisonBasis??null,
  title:`${topic.label} · ${intentLabels[intent]}`,status:'DRAFT / UNASSIGNED',medicalReview:'UNASSIGNED',
  checkedAt:['egfr:PURPOSE','triglycerides:LIMITS','height:COMPARISON','waist:PURPOSE','chest-xray:COMPARISON'].includes(`${topic.key}:${intent}`)?'2026-10-13':'2026-10-12',
  clinicalUse:false,rightsPolicy:detail.url.includes('fda.gov')?urls.fdaPolicy:POLICY,
  rightsScope:detail.url.includes('fda.gov')?'FDA public page; attribution retained':detail.url.endsWith('.html')?'MedlinePlus Health Topic summary only':'MedlinePlus Medical Test information only',
  applicability:`${topic.label} 일반 설명 초안; 개인 수치·결과·진단을 대신하지 않음`,
  questionOrigin:'PROJECT_TEMPLATE',sourceUpdatedAt:null,attribution:detail.url.includes('fda.gov')?'Source: U.S. Food and Drug Administration.':'Source: MedlinePlus, National Library of Medicine.',
  institution:detail.url.includes('fda.gov')?'U.S. Food and Drug Administration':'MedlinePlus · U.S. National Library of Medicine',
  sourceTitle:detail.url===urls.imagingRecord?'Patient Medical Imaging Record Card':undefined,
 });
})));

const sourceUrls=Object.freeze([...new Set([POLICY,...screeningEvidenceEntries.flatMap(e=>[e.url,e.rightsPolicy])])]);
export async function verifyScreeningEvidence(folder){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const notes=await readFile(new URL('notes.json',folder));
 if(manifest.status!=='DRAFT / UNASSIGNED'||manifest.medicalReview!=='UNASSIGNED'||manifest.clinicalUse!==false
  ||manifest.serviceDeployment!==false||sha256(notes)!==manifest.notesSha256||!Array.isArray(manifest.sources)
  ||manifest.entryCount!==80||manifest.topicCount!==20||manifest.sources.length!==sourceUrls.length
  ||notes.toString()!==JSON.stringify(screeningEvidenceEntries,null,2)+'\n')throw Error('SCREENING_EVIDENCE_REJECTED');
 const records=JSON.parse(notes.toString());
 if(!Array.isArray(records)||records.length!==screeningTopics.length*intents.length||records.length!==80
  ||new Set(records.map(e=>e.id)).size!==records.length
  ||records.some(e=>!screeningTopics.some(t=>t.key===e.key)||!intents.includes(e.intent)||e.status!=='DRAFT / UNASSIGNED'
   ||e.medicalReview!=='UNASSIGNED'||e.clinicalUse!==false||!sourceUrls.includes(e.url)||!sourceUrls.includes(e.rightsPolicy)
   ||typeof e.text!=='string'||typeof e.question!=='string'))throw Error('SCREENING_EVIDENCE_REJECTED');
 for(const url of sourceUrls)if(manifest.sources.filter(s=>s.url===url).length!==1)throw Error('SCREENING_SOURCE_MISSING');
 const sourceHtmlByUrl=new Map();
 for(const source of manifest.sources){
  if(!sourceUrls.includes(source.url)||!/^sources\/[a-f0-9]{64}\.html$/.test(source.file))throw Error('SCREENING_SOURCE_REJECTED');
  const html=await readFile(new URL(source.file,folder),'utf8');
  if(sha256(html)!==source.sha256)throw Error('SCREENING_SOURCE_HASH_MISMATCH');
  sourceHtmlByUrl.set(source.url,html);
 }
 if(records.some(entry=>!sourceSectionsExist(sourceHtmlByUrl.get(entry.url),entry.section)))throw Error('SCREENING_SOURCE_SECTION_MISMATCH');
 return manifest;
}

const normalized=value=>value.toLowerCase().replace(/\s+/g,'');
const intentPatterns=[['PURPOSE',/목적|왜|무엇.*(?:검사|확인|측정|정보|나타내)|어떤.*(?:검사|역할|정보)|사용하/],
 ['LIMITS',/한계|알\s*수|판단|진단|판독|결과.*의미|의미|해석|정확|단독|원인|놓칠|구분|확정할 수 없/],
 ['PREPARATION',/준비|금식|검사\s*전|측정\s*전|가져가|가져오|장신구|식사.*제한/],
 ['COMPARISON',/비교|이전|직전|지난|추세|기록을 다시|결과를 다시/]];
const relatedTestIntentByTopic=Object.freeze({
 vision:'PURPOSE',hearing:'LIMITS',hemoglobin:'PURPOSE',egfr:'PURPOSE',
 'urine-protein':'PURPOSE','total-cholesterol':'PURPOSE',hdl:'PURPOSE',ldl:'PURPOSE',
 triglycerides:'LIMITS','hcv-antibody':'LIMITS',dental:'PURPOSE',
});
const relatedTestQuestionPattern=/(?:다른\s*검사|추가\s*검사|함께|같이).*(?:이유|왜|목적)|(?:이유|왜|목적).*(?:다른\s*검사|추가\s*검사|함께|같이)/u;
const personalPattern=/(?:내|제)\s*(?:건강검진|검진|검사|결과|수치|기록|영상|키|체중|몸무게|허리둘레|BMI|혈압|시력|청력|혈색소|헤모글로빈|공복혈당|혈당|크레아티닌|신장|eGFR|요단백|콜레스테롤|HDL|LDL|중성지방|간염|폐기능|흉부|구강)|홍길동|개인.*(?:수치|결과)|결과.*정상인가/iu;
const unsupportedPattern=/(?:정상|참고)\s*(?:범위|수치|기준)(?:\s*(?:가|은|는|이란))?\s*(?:얼마|몇|무엇)|(?:참고|정상)\s*(?:범위|기준|수치)\s*(?:얼마|몇|알려|무엇)|몇\s*(?:이상|미만|정도)|(?:수치|값).*(?:정상인가|정상인지|높은가|낮은가)|(?:얼마나|어느\s*정도).*(?:정상|높|낮|진단)|임계값|진단\s*기준|정상\s*기준/iu;

export function retrieveScreeningEvidence(question){
 if(typeof question!=='string'||!question.trim()||question.length>600)return {status:'INVALID_INPUT',evidence:[]};
 const baseResult=retrieveScenarioEvidence(question);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(baseResult.status))return baseResult;
 if(personalPattern.test(question))return {status:'PERSONAL_INPUT_NOT_SUPPORTED',evidence:[],reason:'PERSONAL_RESULT_NOT_SUPPORTED'};
 if(unsupportedPattern.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'REFERENCE_RANGE_NOT_COVERED'};
 const q=normalized(question),matches=screeningTopics.filter(topic=>topic.aliases.some(alias=>q.includes(normalized(alias))));
 if(matches.length!==1)return matches.length>1?{status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AMBIGUOUS_SCREENING_TOPICS'}:baseResult;
 const topic=matches[0];
 if(relatedTestQuestionPattern.test(question)){
  const supportedIntent=relatedTestIntentByTopic[topic.key];
  if(!supportedIntent)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'RELATED_TEST_RATIONALE_NOT_COVERED'};
  const entry=screeningEvidenceEntries.find(e=>e.key===topic.key&&e.intent===supportedIntent);
  if(!entry)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'RELATED_TEST_EVIDENCE_NOT_FOUND'};
  return {status:'CANDIDATE',topic:`screening-${topic.key}`,intent:'RELATED_TESTS',extractiveOnly:true,
   questionTemplate:'자료에 명시된 이 검사와 다른 검사 사이의 관계는 무엇인가요?',
   evidence:[{chunk_id:entry.id,doc_id:entry.id,topic:`screening-${topic.key}`,title_ko:entry.title,text_ko:entry.text,textSha256:sha256(entry.text),
    source_url:entry.url,source_title:entry.sourceTitle,source_updated_at:null,section_path:[entry.section],contentReview:'UNASSIGNED',clinicalUse:false,
    attribution:entry.attribution,institution:entry.institution,rights_policy_url:entry.rightsPolicy,
    translation_notice:`프로젝트 작성 한국어 요약 초안 · 공식 번역 아님 · 의료전문가 검토 미실시 · ${entry.checkedAt} 확인 · ${entry.applicability}`} ]};
 }
 let selectedIntents=intentPatterns.filter(([,pattern])=>pattern.test(question)).map(([intent])=>intent);
 const hasComparisonCue=/비교|이전|직전|지난|추세|기록을 다시|결과를 다시/.test(question);
 const hasExplicitPurposeCue=/목적|왜|사용하|무엇.*(?:검사|측정|정보|나타내)|어떤.*(?:검사|역할|정보)/.test(question);
 if(hasComparisonCue&&!hasExplicitPurposeCue)selectedIntents=selectedIntents.filter(intent=>intent!=='PURPOSE');
 if(!selectedIntents.length)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'SCREENING_DETAIL_INTENT_NOT_COVERED'};
 if(selectedIntents.length!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AMBIGUOUS_SCREENING_INTENTS'};
 const intent=selectedIntents[0],detail=topic.details[intent];
 const entry=screeningEvidenceEntries.find(e=>e.key===topic.key&&e.intent===intent);
 if(!entry)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'SCREENING_DETAIL_NOT_COVERED'};
  return {status:'CANDIDATE',topic:`screening-${topic.key}`,intent,extractiveOnly:true,questionTemplate:entry.question,
  evidence:[{chunk_id:entry.id,doc_id:entry.id,topic:`screening-${topic.key}`,title_ko:entry.title,text_ko:entry.text,textSha256:sha256(entry.text),
   source_url:entry.url,source_title:entry.sourceTitle,source_updated_at:null,section_path:[entry.section],contentReview:'UNASSIGNED',clinicalUse:false,
   attribution:entry.attribution,institution:entry.institution,rights_policy_url:entry.rightsPolicy,
   translation_notice:`프로젝트 작성 한국어 요약 초안 · 공식 번역 아님 · 의료전문가 검토 미실시 · ${entry.checkedAt} 확인 · ${entry.applicability}`} ]};
}
