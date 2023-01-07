interface keyVal {
    [key: string]: string;
}
interface keyArray {
    [key: string]: string[];
}

interface pathDestination {
    ph: string[];
    dp:number;
 }
 interface pathDestinationObj {
    [key: string]: pathDestination;
 }


async function getData(url:string):Promise<any> {
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    });
    return response.json();
}

async function loadCountriesData():Promise<[keyVal, keyVal]> {
    const countries:any = await getData('https://restcountries.com/v3.1/all?fields=name&fields=cca3');
    
    const arrCCA3toName: keyVal = {};
    const arrNametoCCA3: keyVal = {};
    for (let i:number = 0; i < countries.length; i++) {
        const el:any = countries[i];
        arrCCA3toName[el.cca3] = el.name.common;
        arrNametoCCA3[el.name.common] = el.cca3;
    }
    return [arrCCA3toName, arrNametoCCA3];
}

const form:HTMLElement  = document.getElementById('form') as HTMLElement;
const fromCountry:HTMLInputElement = document.getElementById('fromCountry') as HTMLInputElement;
const toCountry:HTMLInputElement = document.getElementById('toCountry')as HTMLInputElement;
const countriesList:HTMLInputElement = document.getElementById('countriesList') as HTMLInputElement;
const submit:HTMLButtonElement = document.getElementById('submit') as HTMLButtonElement;
const output:HTMLDivElement = document.getElementById('output') as HTMLDivElement;

async function loadBordersCountryData(country:string):Promise<string[]> {
    const countries:any = await getData(`https://restcountries.com/v3.1/alpha/${country}?fields=cca3&fields=borders`);
    return countries.borders.reduce((result:string[], neighbor:string) => {
        result.push(neighbor);
        return result;
    }, []);
}

// path optimization
function minimazePath(maxLength:number, allPath:string[], uniqueElement:string[]):pathDestinationObj {
    const resObject : pathDestinationObj = {};
    for (let i:number = 0; i < uniqueElement.length; i++) {
        const currentCountry:string = uniqueElement[i];
        let minValue:number = maxLength;
        resObject[currentCountry] = { ph: [], dp: maxLength };
        for (let j:number = 0; j < allPath.length; j++) {
            const arr:string[] = allPath[j].split('>');
            const index:number = arr.indexOf(currentCountry);
            if (index >= 0 && index < minValue) {
                minValue = index + 1;
                if (minValue < resObject[currentCountry].dp) {
                    resObject[currentCountry].ph = [];
                    resObject[currentCountry].dp = minValue;
                }
                const element:string = arr.slice(0, minValue).join('>');
                if (resObject[currentCountry].ph.includes(element) === false) {
                    resObject[currentCountry].ph.push(element);
                }
            }
        }
    }
    return resObject;
}

async function getAllPathCountry(fromCountry:string, countryNeighborCach:keyArray, maxDeep:number):Promise<[pathDestinationObj, number]> {
    let countRequest:number = 0;
    const uniqueElement:string[] = [];
    // Find all possible paths from the given country
    async function buildPath(fromCountry:string, deep:number):Promise<string[]> {
        if (deep >= maxDeep) {
            return [fromCountry];
        }
        let arrNeighbor:string[]=[];
        // Let's see where to get information about the country server or cache
        let flagCach:boolean = false;
        if (countryNeighborCach.hasOwnProperty(fromCountry) === true) {
            arrNeighbor = countryNeighborCach[fromCountry];
            flagCach = true;
        } else {
            arrNeighbor = await loadBordersCountryData(fromCountry);
            countRequest += 1;
            countryNeighborCach[fromCountry] = [];
        }
        if (flagCach === false) {
            const index:number = arrNeighbor.indexOf(fromCountry);
            if (index > -1) {
                arrNeighbor.splice(index, 1);
            }
            countryNeighborCach[fromCountry] = arrNeighbor.concat([]);
        }
        const resultArray:Promise<string[]>[] = [];
        for (let i:number = 0; i < arrNeighbor.length; i++) {
            resultArray.push(buildPath(arrNeighbor[i], deep + 1));
            if (uniqueElement.includes(arrNeighbor[i]) === false) {
                uniqueElement.push(arrNeighbor[i]);
            }
        }
        return Promise.all(resultArray).then((result:string[][]):string[] => {
            const resPath:string[] = [];
            for (let i:number = 0; i < result.length; i++) {
                for (let j:number = 0; j < result[i].length; j++) {
                    resPath.push(`${fromCountry}>${result[i][j]}`);
                }
            }
            return resPath;
        });
    }
    const allPath:string[] = await buildPath(fromCountry, 1);
    const minPath = minimazePath(maxDeep, allPath, uniqueElement);
    return [minPath, countRequest];
}
// got two lists of paths.
// The first list is all paths from the starting point.
// The second list is all paths from the endpoint.
// We combine two lists and find the final result

function findShortWay(fromCountry:pathDestinationObj, toCountry:pathDestinationObj, maxDeep:number):string[] {
    const keyFrom:string[] = Object.keys(fromCountry);
    const keyTo:string[] = Object.keys(toCountry);
    let keyMinArr:string[] = [];
    let mxDp:number = maxDeep;
    for (let i:number = 0; i < keyFrom.length; i++) {
        for (let j:number = 0; j < keyTo.length; j++) {
            if (keyFrom[i] === keyTo[j]) {
                const ln:number = fromCountry[keyFrom[i]].dp + toCountry[keyTo[j]].dp;
                if (mxDp === ln) {
                    keyMinArr.push(keyFrom[i]);
                } else if (mxDp < ln) {
                    keyMinArr = [];
                    mxDp = ln;
                }
            }
        }
    }
    const resArray:string[] = [];
    for (let i:number = 0; i < keyMinArr.length; i++) {
        const key:string = keyMinArr[i];
        for (let ii:number = 0; ii < toCountry[key].ph.length; ii++) {
            const second:string = toCountry[key].ph[ii].split('>').reverse().slice(1).join('>');
            for (let jj:number = 0; jj < fromCountry[key].ph.length; jj++) {
                const first:string = fromCountry[key].ph[jj];
                resArray.push(`${first}>${second}`);
            }
        }
    }
    return resArray;
}
function convertPathFromCodeToName(path:string[], converter:keyVal):string[] {
    const pathName:string[] = [];
    for (let i:number = 0; i < path.length; i++) {
        const arr = path[i]
            .split('>')
            .map((x) => converter[x])
            .join('=>');
        pathName.push(arr);
    }
    return pathName;
}
async function startFindShortPath(fromCountry:string, toCountry:string, arrCountry:keyVal):Promise<[string[],number]> {
    const maxDeepHalf:number = 5;
    const countryNeighborCach:keyArray = {};
    const [resultPathfromCountry, cntRequestfromCountry] = await getAllPathCountry(
        fromCountry,
        countryNeighborCach,
        maxDeepHalf
    );
    if (resultPathfromCountry.hasOwnProperty(toCountry) === true) {
        const shortPathsName = convertPathFromCodeToName(resultPathfromCountry[toCountry].ph, arrCountry);
        return [shortPathsName, cntRequestfromCountry];
    }
    const [resultPathftoCountry, cntRequesttoCountry] = await getAllPathCountry(
        toCountry,
        countryNeighborCach,
        maxDeepHalf
    );
    const shortPaths:string[] = findShortWay(resultPathfromCountry, resultPathftoCountry, maxDeepHalf * 2);
    const shortPathsName:string[] = convertPathFromCodeToName(shortPaths, arrCountry);
    return [shortPathsName, cntRequestfromCountry + cntRequesttoCountry];
}

(async () => {
    function setStatusElement(flag:boolean) {
        fromCountry.disabled = flag;
        toCountry.disabled = flag;
        submit.disabled = flag;
    }
    setStatusElement(true);
    output.innerHTML = 'Loading…';
    let countriesData:keyVal;
    let arrNametoCCA3:keyVal;
    try {
        [countriesData, arrNametoCCA3] = await loadCountriesData();
    } catch {
        output.innerHTML = `<p style="color:red">It seems that you do not have an internet connection or the server is not available</p>`;
        setStatusElement(false);
        return;
    }
    output.innerHTML = '';
    Object.keys(countriesData)
        .sort((a, b) => countriesData[b].length - countriesData[a].length)
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code];
            countriesList.appendChild(option);
        });

    setStatusElement(false);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        async function start() {
            if (
                arrNametoCCA3.hasOwnProperty(fromCountry.value) === true &&
                arrNametoCCA3.hasOwnProperty(toCountry.value) === true
            ) {
                if (fromCountry.value === toCountry.value) {
                    output.innerHTML = `<ol><li>${arrNametoCCA3[toCountry.value]}</li></ol><br>`;
                    output.innerHTML += `<h4>It took 0 requests for server</h4>`;
                } else {
                    setStatusElement(true);
                    output.innerHTML = 'Loading…';
                    let path:string[] = [];
                    let cnt:number = 0;
                    try {
                        [path, cnt] = await startFindShortPath(
                            arrNametoCCA3[fromCountry.value],
                            arrNametoCCA3[toCountry.value],
                            countriesData
                        );
                    } catch {
                        output.innerHTML = `<p style="color:red">It seems that you do not have an internet connection or the server is not available</p>`;
                        setStatusElement(false);
                        return;
                    }
                    if (path.length > 0) {
                        output.innerHTML = '<ol>';
                        for (let i = 0; i < path.length; i++) {
                            output.innerHTML += `<li>${path[i]}</li>`;
                        }
                        output.innerHTML += '</ol><br>';
                    } else {
                        output.innerHTML = '<h5>Unfortunately the path was not found.</h5><br>';
                    }
                    output.innerHTML += `<h4>It took ${cnt} requests for server</h4>`;
                    setStatusElement(false);
                }
            } else {
                output.innerHTML = `<h4>Some countries do not yet exist on our list(${fromCountry.value} or ${toCountry.value})</h4>`;
            }
        }
        start();
        // TODO: Вывести, откуда и куда едем, и что идёт расчёт.
        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        // TODO: Вывести маршрут и общее количество запросов.
    });
})();
