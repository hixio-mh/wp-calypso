/**
 * External dependencies
 */
import { By } from 'selenium-webdriver';

/**
 * Internal dependencies
 */
import AsyncBaseContainer from '../../async-base-container';

import * as driverHelper from '../../driver-helper';

export default class ContactFormPage extends AsyncBaseContainer {
	constructor( driver ) {
		super( driver, By.css( '.steps__main[data-e2e-type="contact-form"]' ) );
	}

	async selectAddContactForm() {
		return await driverHelper.clickWhenClickable(
			this.driver,
			By.css( '.card[data-e2e-type="contact-form"] button' )
		);
	}

	async selectContinue() {
		const continueLocator = By.css( '.card[data-e2e-type="continue"] button' );
		return await driverHelper.clickWhenClickable( this.driver, continueLocator );
	}
}
