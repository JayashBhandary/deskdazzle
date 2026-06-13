import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';

function RecipeFinder() {
  const { theme } = useContext(ThemeContext);
  const [query, setQuery] = useState('');
  const [meals, setMeals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('idle');

  const search = async () => {
    if (!query.trim()) return;
    setStatus('loading');
    setMeals([]);
    setSelected(null);
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`
      ).then((r) => r.json());
      setMeals(res.meals || []);
      setStatus(res.meals ? 'idle' : 'empty');
    } catch {
      setStatus('error');
    }
  };

  const ingredients = (meal) => {
    const list = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ing && ing.trim()) list.push(`${measure || ''} ${ing}`.trim());
    }
    return list;
  };

  return (
    <div className='page'>
      <div className='page__content'>
        <label>📜 RecipeFinder</label>
        <div className='content'>
          <div className='tool' style={{ flexDirection: 'column', width: '100%' }}>
            <div className='card'>
              <input
                className={`${theme ? 'dark' : 'light'}`}
                value={query}
                placeholder='Search a dish (e.g. pasta)'
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
              />
              <button className='submit-btn' style={{ color: theme ? 'white' : 'black' }} onClick={search}>Find</button>
            </div>

            {status === 'loading' && <p>Searching...</p>}
            {status === 'empty' && <p>No recipes found. 🍽️</p>}
            {status === 'error' && <p className='tool__error'>Something went wrong. Try again.</p>}

            {selected ? (
              <div className={`recipe-detail ${theme ? 'dark' : 'light'}`}>
                <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={() => setSelected(null)}>← Back</button>
                <h2>{selected.strMeal}</h2>
                <img src={selected.strMealThumb} alt={selected.strMeal} className='recipe-detail__img' />
                <p><strong>{selected.strCategory}</strong> · {selected.strArea}</p>
                <h3>Ingredients</h3>
                <ul className='recipe-detail__ing'>
                  {ingredients(selected).map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
                <h3>Instructions</h3>
                <p className='recipe-detail__steps'>{selected.strInstructions}</p>
              </div>
            ) : (
              <div className='recipe-grid'>
                {meals.map((meal) => (
                  <div key={meal.idMeal} className={`recipe-card ${theme ? 'dark' : 'light'}`} onClick={() => setSelected(meal)}>
                    <img src={meal.strMealThumb} alt={meal.strMeal} />
                    <p>{meal.strMeal}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecipeFinder
