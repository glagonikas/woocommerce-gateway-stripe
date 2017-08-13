/* global wc_stripe_params */

jQuery( function( $ ) {
	'use strict';

	var stripe = Stripe( wc_stripe_params.key );

	if ( 'yes' === wc_stripe_params.use_elements ) {
		var elements = stripe.elements(),
			stripe_card;
	}

	/**
	 * Object to handle Stripe elements payment form.
	 */
	var wc_stripe_form = {
		/**
		 * Get WC AJAX endpoint URL.
		 *
		 * @param  {String} endpoint Endpoint.
		 * @return {String}
		 */
		getAjaxURL: function( endpoint ) {
			return wc_stripe_params.ajaxurl
				.toString()
				.replace( '%%endpoint%%', 'wc_stripe_' + endpoint );
		},

		/**
		 * Initialize event handlers and UI state.
		 */
		init: function() {
			// checkout page
			if ( $( 'form.woocommerce-checkout' ).length ) {
				this.form = $( 'form.woocommerce-checkout' );
			}

			$( 'form.woocommerce-checkout' )
				.on(
					'checkout_place_order_stripe checkout_place_order_stripe_bancontact checkout_place_order_stripe_sofort checkout_place_order_stripe_giropay checkout_place_order_stripe_ideal checkout_place_order_stripe_alipay checkout_place_order_stripe_sepa checkout_place_order_stripe_bitcoin',
					this.onSubmit
				);

			// pay order page
			if ( $( 'form#order_review' ).length ) {
				this.form = $( 'form#order_review' );
			}

			$( 'form#order_review' )
				.on(
					'submit',
					this.onSubmit
				);

			// add payment method page
			if ( $( 'form#add_payment_method' ).length ) {
				this.form = $( 'form#add_payment_method' );
			}

			$( 'form#add_payment_method' )
				.on(
					'submit',
					this.onSubmit
				);

			$( 'form.woocommerce-checkout' )
				.on(
					'change',
					'#stripe-bank-country',
					this.reset
				);

			$( document )
				.on(
					'stripeError',
					this.onError
				)
				.on(
					'checkout_error',
					this.reset
				);

			var style = {
				base: {
					iconColor: '#666EE8',
					color: '#31325F',
					lineHeight: '45px',
					fontSize: '15px',
					'::placeholder': {
				  		color: '#CFD7E0',
					}
				}
			};

			if ( 'yes' === wc_stripe_params.use_elements && $( '#stripe-card-element' ).length ) {
				stripe_card = elements.create( 'card', { style: style, hidePostalCode: true } );

				stripe_card.addEventListener( 'change', function( event ) {
					wc_stripe_form.onCCFormChange();

					if ( event.error ) {
						$( document.body ).trigger( 'stripeError', event );
					}
				});

				/**
				 * Only in checkout page we need to delay the mounting of the
				 * card as some AJAX process needs to happen before we do.
				 */
				if ( wc_stripe_params.is_checkout ) {
					$( document.body ).on( 'updated_checkout', function() {
						// Don't mount elements a second time.
						if ( stripe_card ) {
							stripe_card.unmount( '#stripe-card-element' );
						}

						stripe_card.mount( '#stripe-card-element' );
					});
				} else if ( $( 'form#add_payment_method' ).length || $( 'form#order_review' ).length ) {
					stripe_card.mount( '#stripe-card-element' );
				}
			}
		},

		isStripeChosen: function() {
			return $( '#payment_method_stripe, #payment_method_stripe_bancontact, #payment_method_stripe_sofort, #payment_method_stripe_giropay, #payment_method_stripe_ideal, #payment_method_stripe_alipay, #payment_method_stripe_sepa, #payment_method_stripe_bitcoin' ).is( ':checked' ) || 'new' === $( 'input[name="wc-stripe-payment-token"]:checked' ).val();
		},

		// Currently only support saved cards via credit cards. No other payment method.
		isStripeSaveCardChosen: function() {
			return $( '#payment_method_stripe' ).is( ':checked' ) && 'new' !== $( 'input[name="wc-stripe-payment-token"]:checked' ).val();
		},

		isStripeCardChosen: function() {
			return $( '#payment_method_stripe' ).is( ':checked' );
		},

		isBancontactChosen: function() {
			return $( '#payment_method_stripe_bancontact' ).is( ':checked' );
		},

		isGiropayChosen: function() {
			return $( '#payment_method_stripe_giropay' ).is( ':checked' );
		},

		isIdealChosen: function() {
			return $( '#payment_method_stripe_ideal' ).is( ':checked' );
		},

		isSofortChosen: function() {
			return $( '#payment_method_stripe_sofort' ).is( ':checked' );
		},

		isAlipayChosen: function() {
			return $( '#payment_method_stripe_alipay' ).is( ':checked' );
		},

		isSepaChosen: function() {
			return $( '#payment_method_stripe_sepa' ).is( ':checked' );
		},

		isBitcoinChosen: function() {
			return $( '#payment_method_stripe_bitcoin' ).is( ':checked' );
		},

		hasSource: function() {
			return 0 < $( 'input.stripe-source' ).length;
		},

		// Legacy
		hasToken: function() {
			return 0 < $( 'input.stripe_token' ).length;
		},

		isMobile: function() {
			if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
				return true;
			}

			return false;
		},

		block: function() {
			if ( wc_stripe_form.isMobile() ) {
				$.blockUI({
					message: null,
					overlayCSS: {
						background: '#fff',
						opacity: 0.6
					}
				});
			} else {
				wc_stripe_form.form.block({
					message: null,
					overlayCSS: {
						background: '#fff',
						opacity: 0.6
					}
				});
			}
		},

		unblock: function() {
			if ( wc_stripe_form.isMobile() ) {
				$.unblockUI();
			} else {
				wc_stripe_form.form.unblock();
			}
		},

		getSelectedPaymentElement: function() {
			return $( '.payment_methods input[name="payment_method"]:checked' );
		},

		onError: function( e, result ) {
			var message = result.error.message,
				errorContainer = wc_stripe_form.getSelectedPaymentElement().parent( '.wc_payment_method, .woocommerce-PaymentMethod' ).find( '.stripe-source-errors' );

			// Customers do not need to know the specifics of the below type of errors
			// therefore return a generic localizable error message.
			if ( 
				'invalid_request_error' === result.error.type ||
				'api_connection_error'  === result.error.type ||
				'api_error'             === result.error.type ||
				'authentication_error'  === result.error.type ||
				'rate_limit_error'      === result.error.type
			) {
				message = wc_stripe_params.invalid_request_error;
			}

			if ( 'card_error' === result.error.type && wc_stripe_params.hasOwnProperty( result.error.code ) ) {
				message = wc_stripe_params[ result.error.code ];
			}

			wc_stripe_form.reset();
			console.log( result.error.message ); // Leave for troubleshooting.
			$( errorContainer ).html( '<ul class="woocommerce_error woocommerce-error wc-stripe-error"><li>' + message + '</li></ul>' );
			wc_stripe_form.unblock();
		},

		getOwnerDetails: function() {
			var first_name = $( '#billing_first_name' ).length ? $( '#billing_first_name' ).val() : wc_stripe_params.billing_first_name,
				last_name  = $( '#billing_last_name' ).length ? $( '#billing_last_name' ).val() : wc_stripe_params.billing_last_name,
				extra_details = { owner: { name: '', address: {}, email: '', phone: '' } };

			extra_details.owner.name = first_name;

			if ( first_name && last_name ) {
				extra_details.owner.name = first_name + ' ' + last_name;
			}

			extra_details.owner.email = $( '#billing_email' ).val();
			extra_details.owner.phone = $( '#billing_phone' ).val();

			if ( $( '#billing_address_1' ).length > 0 ) {
				extra_details.owner.address.line1       = $( '#billing_address_1' ).val();
				extra_details.owner.address.line2       = $( '#billing_address_2' ).val();
				extra_details.owner.address.state       = $( '#billing_state' ).val();
				extra_details.owner.address.city        = $( '#billing_city' ).val();
				extra_details.owner.address.postal_code = $( '#billing_postcode' ).val();
				extra_details.owner.address.country     = $( '#billing_country' ).val();
			} else if ( wc_stripe_params.billing_address_1 ) {
				extra_details.owner.address.line1       = wc_stripe_params.billing_address_1;
				extra_details.owner.address.line2       = wc_stripe_params.billing_address_2;
				extra_details.owner.address.state       = wc_stripe_params.billing_state;
				extra_details.owner.address.city        = wc_stripe_params.billing_city;
				extra_details.owner.address.postal_code = wc_stripe_params.billing_postcode;
				extra_details.owner.address.country     = wc_stripe_params.billing_country;
			}

			return extra_details;
		},

		createSource: function() {
			var extra_details = wc_stripe_form.getOwnerDetails(),
				source_type   = 'card';

			if ( wc_stripe_form.isBancontactChosen() ) {
				source_type = 'bancontact';
			}

			if ( wc_stripe_form.isSepaChosen() ) {
				source_type = 'sepa_debit';
			}

			if ( wc_stripe_form.isIdealChosen() ) {
				source_type = 'ideal';
			}

			if ( wc_stripe_form.isSofortChosen() ) {
				source_type = 'sofort';
			}

			if ( wc_stripe_form.isBitcoinChosen() ) {
				source_type = 'bitcoin';
			}

			if ( wc_stripe_form.isGiropayChosen() ) {
				source_type = 'giropay';
			}

			if ( wc_stripe_form.isAlipayChosen() ) {
				source_type = 'alipay';
			}

			if ( 'card' === source_type ) {
				stripe.createSource( stripe_card, extra_details ).then( wc_stripe_form.sourceResponse );
			} else {
				switch ( source_type ) {
					case 'bancontact':
					case 'giropay':
					case 'ideal':
					case 'sofort':
					case 'alipay':
						// These redirect flow payment methods need this information to be set at source creation.
						extra_details.amount   = $( '#stripe-' + source_type + '-payment-data' ).data( 'amount' );
						extra_details.currency = $( '#stripe-' + source_type + '-payment-data' ).data( 'currency' );
						extra_details.redirect = { return_url: wc_stripe_params.return_url };

						if ( 'bancontact' === source_type ) {
							extra_details.bancontact = { statement_descriptor: wc_stripe_params.statement_descriptor };
						}

						if ( 'giropay' === source_type ) {
							extra_details.giropay = { statement_descriptor: wc_stripe_params.statement_descriptor };
						}

						if ( 'ideal' === source_type ) {
							extra_details.ideal = { statement_descriptor: wc_stripe_params.statement_descriptor };
						}

						if ( 'sofort' === source_type ) {
							extra_details.sofort = { statement_descriptor: wc_stripe_params.statement_descriptor };
						}

						break;
				}

				// Handle special inputs that are unique to a payment method.
				switch ( source_type ) {
					case 'sepa_debit':
						extra_details.currency = $( '#stripe-' + source_type + '-payment-data' ).data( 'currency' );
						extra_details.sepa_debit = { iban: $( '#stripe-sepa-iban' ).val() };
						break;
					case 'ideal':
						extra_details.ideal = { bank: $( '#stripe-ideal-bank' ).val() };
						break;
					case 'sofort':
						extra_details.sofort = { country: $( '#stripe-sofort-country' ).val() };
						break;
					case 'bitcoin':
					case 'alipay':
						extra_details.currency = $( '#stripe-' + source_type + '-payment-data' ).data( 'currency' );
						extra_details.amount = $( '#stripe-' + source_type + '-payment-data' ).data( 'amount' );
						break;
				}

				extra_details.type = source_type;

				stripe.createSource( extra_details ).then( wc_stripe_form.sourceResponse );
			}
		},

		sourceResponse: function( response ) {
			if ( response.error ) {
				$( document.body ).trigger( 'stripeError', response );
			} else if ( 'no' === wc_stripe_params.allow_prepaid_card && 'card' === response.source.type && 'prepaid' === response.source.card.funding ) {
				response.error = { message: wc_stripe_params.no_prepaid_card_msg };

				$( document.body ).trigger( 'stripeError', response );	
			} else {
				wc_stripe_form.processStripeResponse( response.source );
			}
		},

		// Legacy
		createToken: function() {
			var card       = $( '#stripe-card-number' ).val(),
				cvc        = $( '#stripe-card-cvc' ).val(),
				expires    = $( '#stripe-card-expiry' ).payment( 'cardExpiryVal' ),
				first_name = $( '#billing_first_name' ).length ? $( '#billing_first_name' ).val() : wc_stripe_params.billing_first_name,
				last_name  = $( '#billing_last_name' ).length ? $( '#billing_last_name' ).val() : wc_stripe_params.billing_last_name,
				data       = {
					number   : card,
					cvc      : cvc,
					exp_month: parseInt( expires.month, 10 ) || 0,
					exp_year : parseInt( expires.year, 10 ) || 0
				};

			if ( first_name && last_name ) {
				data.name = first_name + ' ' + last_name;
			}

			if ( $( '#billing_address_1' ).length > 0 ) {
				data.address_line1   = $( '#billing_address_1' ).val();
				data.address_line2   = $( '#billing_address_2' ).val();
				data.address_state   = $( '#billing_state' ).val();
				data.address_city    = $( '#billing_city' ).val();
				data.address_zip     = $( '#billing_postcode' ).val();
				data.address_country = $( '#billing_country' ).val();
			} else if ( wc_stripe_params.billing_address_1 ) {
				data.address_line1   = wc_stripe_params.billing_address_1;
				data.address_line2   = wc_stripe_params.billing_address_2;
				data.address_state   = wc_stripe_params.billing_state;
				data.address_city    = wc_stripe_params.billing_city;
				data.address_zip     = wc_stripe_params.billing_postcode;
				data.address_country = wc_stripe_params.billing_country;
			}

			Stripe.createToken( data, wc_stripe_form.onStripeTokenResponse );
		},

		// Legacy
		onStripeTokenResponse: function( status, response ) {
			if ( response.error ) {
				$( document ).trigger( 'stripeError', { response: response } );
			} else {
				// check if we allow prepaid cards
				if ( 'no' === wc_stripe_params.allow_prepaid_card && 'prepaid' === response.card.funding ) {
					response.error = { message: wc_stripe_params.no_prepaid_card_msg };

					$( document ).trigger( 'stripeError', { response: response } );
					
					return false;
				}

				// token contains id, last4, and card type
				var token = response.id;

				// insert the token into the form so it gets submitted to the server
				wc_stripe_form.form.append( "<input type='hidden' class='stripe_token' name='stripe_token' value='" + token + "'/>" );
				wc_stripe_form.form.submit();
			}
		},

		onSubmit: function( e ) {
			if ( wc_stripe_form.isStripeChosen() && ! wc_stripe_form.isStripeSaveCardChosen() && ! wc_stripe_form.hasSource() && ! wc_stripe_form.hasToken() ) {
				e.preventDefault();
				wc_stripe_form.block();

				// Process legacy card token.
				if ( wc_stripe_form.isStripeCardChosen() && 'no' === wc_stripe_params.use_elements ) {
					wc_stripe_form.createToken();
					return false;	
				}

				if (
					wc_stripe_form.isBancontactChosen() ||
					wc_stripe_form.isGiropayChosen() ||
					wc_stripe_form.isIdealChosen() ||
					wc_stripe_form.isAlipayChosen() 
				) {
					if ( $( 'form#order_review' ).length ) {
						$( 'form#order_review' )
							.off(
								'submit',
								this.onSubmit
							);

						wc_stripe_form.form.submit();
					}

					return true;
				}

				if ( wc_stripe_form.isSofortChosen() ) {
					// Check if Sofort bank country is chosen before proceed.
					if ( '-1' === $( '#stripe-bank-country' ).val() ) {
						var error = { error: { message: wc_stripe_params.no_bank_country_msg } };
						$( document.body ).trigger( 'stripeError', error );
						return false;
					}

					if ( $( 'form#order_review' ).length ) {
						$( 'form#order_review' )
							.off(
								'submit',
								this.onSubmit
							);

						wc_stripe_form.form.submit();
					}

					return true;
				}

				if ( wc_stripe_form.isSepaChosen() ) {
					// Check if SEPA IBAN is filled before proceed.
					if ( '' === $( '#stripe-sepa-iban' ).val() ) {
						var errors = { error: { message: wc_stripe_params.no_iban_msg } };
						$( document.body ).trigger( 'stripeError', errors );
						return false;
					}

					wc_stripe_form.validateCheckout();
				}

				wc_stripe_form.validateCheckout();

				// Prevent form submitting
				return false;
			} else if ( $( 'form#add_payment_method' ).length ) {
				e.preventDefault();
				wc_stripe_form.block();

				wc_stripe_form.createSource();
				return false;
			}
		},

		onCCFormChange: function() {
			wc_stripe_form.reset();
		},

		processStripeResponse: function( source ) {
			wc_stripe_form.reset();

			// Insert the Source into the form so it gets submitted to the server.
			wc_stripe_form.form.append( "<input type='hidden' class='stripe-source' name='stripe_source' value='" + JSON.stringify( source ) + "'/>" );

			if ( $( 'form#add_payment_method' ).length ) {
				$( wc_stripe_form.form ).off( 'submit', wc_stripe_form.form.onSubmit );
			}

			wc_stripe_form.form.submit();
		},

		reset: function() {
			$( '.wc-stripe-error, .stripe-source, .stripe_token' ).remove();
		},

		getRequiredFields: function() {
			return wc_stripe_form.form.find( '.form-row.validate-required > input, .form-row.validate-required > select' );
		},

		validateCheckout: function() {
			var data = {
				'nonce': wc_stripe_params.stripe_nonce,
				'required_fields': wc_stripe_form.getRequiredFields().serialize(),
				'all_fields': wc_stripe_form.form.serialize(),
				'source_type': wc_stripe_form.getSelectedPaymentElement().val()
			};

			$.ajax({
				type:		'POST',
				url:		wc_stripe_form.getAjaxURL( 'validate_checkout' ),
				data:		data,
				dataType:   'json',
				success:	function( result ) {
					if ( 'success' === result ) {
						wc_stripe_form.createSource();
					} else if ( result.messages ) {
						wc_stripe_form.reset();
						wc_stripe_form.submitError( result.messages );
					}
				}
			});	
		},

		submitError: function( error_message ) {
			$( '.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message' ).remove();
			wc_stripe_form.form.prepend( '<div class="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout">' + error_message + '</div>' );
			wc_stripe_form.form.removeClass( 'processing' ).unblock();
			wc_stripe_form.form.find( '.input-text, select, input:checkbox' ).blur();
			$( 'html, body' ).animate({
				scrollTop: ( $( 'form.checkout' ).offset().top - 100 )
			}, 1000 );
			$( document.body ).trigger( 'checkout_error' );
		}
	};

	wc_stripe_form.init();
} );
