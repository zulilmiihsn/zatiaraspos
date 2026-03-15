package com.zatiaras.pos.feature.pos.presentation.checkout

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.QrCode2
import compose.icons.EvaIcons
import compose.icons.evaicons.Outline
import compose.icons.evaicons.outline.ArrowBack
import compose.icons.evaicons.outline.CheckmarkCircle2
import compose.icons.evaicons.outline.CreditCard
import compose.icons.evaicons.outline.FileText
import compose.icons.evaicons.outline.Grid
import compose.icons.evaicons.outline.Layers
import compose.icons.evaicons.outline.Person
import compose.icons.evaicons.outline.Smartphone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import com.zatiaras.pos.core.ui.theme.Slate900
import com.zatiaras.pos.core.ui.theme.Brand500
import com.zatiaras.pos.core.ui.theme.Slate700
import com.zatiaras.pos.core.ui.theme.Slate50
import com.zatiaras.pos.core.ui.theme.Slate100
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zatiaras.pos.feature.pos.R
import androidx.hilt.navigation.compose.hiltViewModel
import com.zatiaras.pos.core.ui.components.CurrencyTextField
import com.zatiaras.pos.core.ui.components.ZatDialog
import com.zatiaras.pos.core.ui.theme.AppShapes
import com.zatiaras.pos.core.ui.theme.LocalDimensions
import com.zatiaras.pos.core.ui.util.CurrencyFormatter
import com.zatiaras.pos.feature.pos.domain.model.Cart
import com.zatiaras.pos.feature.pos.domain.model.CartItem
import com.zatiaras.pos.feature.pos.domain.model.PaymentMethod
import com.zatiaras.pos.feature.pos.domain.model.Transaction
import com.zatiaras.pos.feature.pos.presentation.CheckoutEvent
import java.text.NumberFormat

/**
 * Checkout Screen for completing payment.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun CheckoutRoute(
    cart: Cart,
    onNavigateBack: () -> Unit,
    onPaymentSuccess: (Transaction) -> Unit,
    viewModel: CheckoutViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    
    val priceFormatter = CurrencyFormatter.getCurrencyFormatter()
    
    // Bottom Sheet State
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showPaymentSheet by remember { mutableStateOf(false) }
    
    // Initialize cart on first composition
    LaunchedEffect(cart) {
        viewModel.initializeWithCart(cart)
    }
    
    // Track last ready state to prevent abrupt UI removal during success transition
    var lastReadyState by remember { mutableStateOf<CheckoutUiState.Ready?>(null) }
    
    LaunchedEffect(uiState) {
        val currentState = uiState
        if (currentState is CheckoutUiState.Ready) {
            lastReadyState = currentState
        }
    }
    
    // Show error snackbar
    LaunchedEffect(uiState) {
        val state = uiState
        if (state is CheckoutUiState.Ready && state.paymentError != null) {
            snackbarHostState.showSnackbar(state.paymentError)
            viewModel.onEvent(CheckoutEvent.DismissError)
        }
    }
    
    // Handle success transition smoothly
    LaunchedEffect(uiState) {
        val currentState = uiState
        if (currentState is CheckoutUiState.Success) {
            val transaction = currentState.transaction
            if (showPaymentSheet) {
                // Gracefully hide bottom sheet before navigating away
                sheetState.hide()
                showPaymentSheet = false
            }
            onPaymentSuccess(transaction)
        }
    }
    
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        stringResource(R.string.checkout_title),
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = EvaIcons.Outline.ArrowBack,
                            contentDescription = null
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = { com.zatiaras.pos.core.ui.components.ZatSnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        when (val state = uiState) {
            is CheckoutUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            
            is CheckoutUiState.Ready, is CheckoutUiState.Success -> {
                val stateToRender = (state as? CheckoutUiState.Ready) ?: lastReadyState
                
                if (stateToRender != null) {
                    CheckoutContent(
                        state = stateToRender,
                        priceFormatter = priceFormatter,
                        onEvent = viewModel::onEvent,
                        onOpenPaymentSheet = { method ->
                            viewModel.onEvent(CheckoutEvent.SetPaymentMethod(method))
                            showPaymentSheet = true
                        },
                        modifier = Modifier.padding(paddingValues)
                    )

                    if (showPaymentSheet) {
                        ModalBottomSheet(
                            onDismissRequest = { showPaymentSheet = false },
                            sheetState = sheetState
                        ) {
                            PaymentSheetContent(
                                state = stateToRender,
                                onEvent = viewModel::onEvent,
                                onQuickAmount = viewModel::setQuickAmount,
                                onExactAmount = viewModel::setExactAmount,
                                onClearAmount = viewModel::clearAmount,
                                onConfirm = {
                                    viewModel.onEvent(CheckoutEvent.ConfirmPayment)
                                }
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                        }
                    }
                }
                
                if (state is CheckoutUiState.Success) {
                    // Provide a subtle loading indicator overlay if the sheet is closed while navigating
                    if (!showPaymentSheet) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(paddingValues),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                }
            }
            
            is CheckoutUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
private fun CheckoutContent(
    state: CheckoutUiState.Ready,
    priceFormatter: NumberFormat,
    onEvent: (CheckoutEvent) -> Unit,
    onOpenPaymentSheet: (PaymentMethod) -> Unit,
    modifier: Modifier = Modifier
) {
    val dimensions = LocalDimensions.current
    var showDiscountDialog by remember { mutableStateOf(false) }
    var showTaxDialog by remember { mutableStateOf(false) }
    var discountInput by remember { mutableStateOf("") }
    var discountCashierInput by remember { mutableStateOf("") }
    var taxInput by remember { mutableStateOf("") }

    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = dimensions.paddingM),
        contentPadding = PaddingValues(vertical = dimensions.paddingM),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // 1 & 2. Customer Info
        item {
            androidx.compose.material3.Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = androidx.compose.material3.CardDefaults.cardColors(
                    containerColor = Slate50
                ),
                elevation = androidx.compose.material3.CardDefaults.cardElevation(defaultElevation = 0.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Slate100)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    OutlinedTextField(
                        value = state.customerName,
                        onValueChange = { onEvent(CheckoutEvent.SetCustomerName(it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.checkout_customer_name_hint)) },
                        leadingIcon = {
                            Icon(EvaIcons.Outline.Person, contentDescription = null, tint = Slate900)
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                            unfocusedContainerColor = androidx.compose.ui.graphics.Color.White,
                            focusedContainerColor = androidx.compose.ui.graphics.Color.White
                        )
                    )

                    OutlinedTextField(
                        value = state.notes,
                        onValueChange = { onEvent(CheckoutEvent.SetNotes(it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.checkout_order_notes_hint)) },
                        leadingIcon = {
                            Icon(EvaIcons.Outline.FileText, contentDescription = null, tint = Slate900)
                        },
                        minLines = 1,
                        maxLines = 3,
                        shape = RoundedCornerShape(12.dp),
                        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                            unfocusedContainerColor = androidx.compose.ui.graphics.Color.White,
                            focusedContainerColor = androidx.compose.ui.graphics.Color.White
                        )
                    )
                }
            }
        }

        // 3. Order Summary Flat
        item {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = stringResource(R.string.checkout_order_summary),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                
                // Item List
                if (state.cart.items.isNotEmpty()) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        state.cart.items.forEach { item ->
                            CartItemRow(item = item)
                        }
                    }
                    
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            discountInput = state.discountPercent.toPercentInputString()
                            discountCashierInput = state.discountCashierName
                            showDiscountDialog = true
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.checkout_discount, state.discountPercent.toPercentDisplayString()),
                            color = Brand500,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    OutlinedButton(
                        onClick = {
                            taxInput = state.taxPercent.toPercentInputString()
                            showTaxDialog = true
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.checkout_tax, state.taxPercent.toPercentDisplayString()),
                            color = Brand500,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
                
                // Totals Section
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Subtotal
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = stringResource(R.string.checkout_subtotal),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = priceFormatter.format(state.subtotal),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    
                    // Discount
                    if (state.discountAmount > 0) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = stringResource(R.string.checkout_discount, state.discountPercent.toPercentDisplayString()),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.error
                            )
                            Text(
                                text = stringResource(
                                    R.string.checkout_discount_value,
                                    priceFormatter.format(state.discountAmount)
                                ),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.error,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        if (state.discountCashierName.isNotBlank()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = stringResource(R.string.checkout_discount_cashier_name_label),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = state.discountCashierName,
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Medium,
                                    color = Slate900
                                )
                            }
                        }
                    }
                    
                    // Tax
                    if (state.taxPercent >= 1.0 && state.taxAmount > 0) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = stringResource(R.string.checkout_tax, state.taxPercent.toPercentDisplayString()),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = priceFormatter.format(state.taxAmount),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
                
                // Grand Total Highlighted
                Surface(
                    color = Brand500.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(R.string.checkout_grand_total),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Brand500
                        )
                        Text(
                            text = priceFormatter.format(state.grandTotal),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = Brand500
                        )
                    }
                }
            }
        }
        
        // 4. Payment Method Selection
        item {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    text = stringResource(R.string.checkout_payment_method),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    PaymentMethodButton(
                        method = PaymentMethod.CASH,
                        icon = Icons.Default.Payments,
                        isSelected = state.selectedPaymentMethod == PaymentMethod.CASH,
                        onClick = { onOpenPaymentSheet(PaymentMethod.CASH) },
                        modifier = Modifier.weight(1f)
                    )
                    
                    PaymentMethodButton(
                        method = PaymentMethod.QRIS,
                        icon = Icons.Default.QrCode2,
                        isSelected = state.selectedPaymentMethod == PaymentMethod.QRIS,
                        onClick = { onOpenPaymentSheet(PaymentMethod.QRIS) },
                        modifier = Modifier.weight(1f)
                    )
                    
                    PaymentMethodButton(
                        method = PaymentMethod.TRANSFER,
                        icon = Icons.Default.AccountBalance,
                        isSelected = state.selectedPaymentMethod == PaymentMethod.TRANSFER,
                        onClick = { onOpenPaymentSheet(PaymentMethod.TRANSFER) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
        
        item {
            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    if (showDiscountDialog) {
        ZatDialog(onDismissRequest = { showDiscountDialog = false }) { dismiss ->
            Box(
                modifier = Modifier.fillMaxWidth(0.95f),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f), AppShapes.XXL),
                    shape = AppShapes.XXL,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .background(Brand500.copy(alpha = 0.14f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = EvaIcons.Outline.CreditCard,
                                    contentDescription = null,
                                    tint = Brand500
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = stringResource(R.string.checkout_discount_percent_label),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        OutlinedTextField(
                            value = discountInput,
                            onValueChange = { value ->
                                if (value.isEmpty() || value.all { it.isDigit() || it == '.' }) {
                                    discountInput = value
                                }
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            label = { Text(stringResource(R.string.checkout_discount_percent_label)) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = AppShapes.M
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = discountCashierInput,
                            onValueChange = { discountCashierInput = it },
                            singleLine = true,
                            label = { Text(stringResource(R.string.checkout_discount_cashier_name_label)) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = AppShapes.M
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedButton(
                                onClick = dismiss,
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = AppShapes.M
                            ) { Text(stringResource(R.string.dialog_cancel)) }

                            Button(
                                onClick = {
                                    onEvent(CheckoutEvent.SetDiscountPercent(discountInput))
                                    onEvent(CheckoutEvent.SetDiscountCashierName(discountCashierInput.trim()))
                                    dismiss()
                                },
                                enabled = discountInput.toDoubleOrNull() != null,
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = AppShapes.M,
                                colors = ButtonDefaults.buttonColors(containerColor = Brand500)
                            ) {
                                Text(stringResource(R.string.cash_record_save), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showTaxDialog) {
        ZatDialog(onDismissRequest = { showTaxDialog = false }) { dismiss ->
            Box(
                modifier = Modifier.fillMaxWidth(0.95f),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f), AppShapes.XXL),
                    shape = AppShapes.XXL,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .background(Brand500.copy(alpha = 0.14f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = EvaIcons.Outline.Layers,
                                    contentDescription = null,
                                    tint = Brand500
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = stringResource(R.string.checkout_tax_percent_label),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        OutlinedTextField(
                            value = taxInput,
                            onValueChange = { value ->
                                if (value.isEmpty() || value.all { it.isDigit() || it == '.' }) {
                                    taxInput = value
                                }
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            label = { Text(stringResource(R.string.checkout_tax_percent_label)) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = AppShapes.M
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedButton(
                                onClick = dismiss,
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = AppShapes.M
                            ) { Text(stringResource(R.string.dialog_cancel)) }

                            Button(
                                onClick = {
                                    onEvent(CheckoutEvent.SetTaxPercent(taxInput))
                                    dismiss()
                                },
                                enabled = taxInput.toDoubleOrNull() != null,
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = AppShapes.M,
                                colors = ButtonDefaults.buttonColors(containerColor = Brand500)
                            ) {
                                Text(stringResource(R.string.cash_record_save), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun Double.toPercentInputString(): String {
    return if (this % 1.0 == 0.0) this.toInt().toString() else this.toString()
}

private fun Double.toPercentDisplayString(): String {
    return this.toBigDecimal().stripTrailingZeros().toPlainString()
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PaymentSheetContent(
    state: CheckoutUiState.Ready,
    onEvent: (CheckoutEvent) -> Unit,
    onQuickAmount: (Long) -> Unit,
    onExactAmount: () -> Unit,
    onClearAmount: () -> Unit,
    onConfirm: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Title
        Text(
            text = stringResource(
                R.string.checkout_payment_title,
                state.selectedPaymentMethod?.displayName ?: ""
            ),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        
        HorizontalDivider()

        when (state.selectedPaymentMethod) {
            null -> {}
            PaymentMethod.CASH -> {
                // Cash Payment Logic
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = stringResource(R.string.checkout_grand_total_amount, CurrencyFormatter.formatCurrency(state.grandTotal)),
                        style = MaterialTheme.typography.titleMedium,
                        color = Slate900,
                        fontWeight = FontWeight.SemiBold
                    )
                    
                    CurrencyTextField(
                        value = state.amountPaid,
                        onValueChange = { onEvent(CheckoutEvent.SetAmountPaid(it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.checkout_amount_received_label)) },
                        showPrefix = true,
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                    
                    // Quick amount header
                    Text(
                        text = stringResource(R.string.checkout_quick_amount),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                    
                    // Chips layout
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        QuickAmountChip(
                            text = stringResource(R.string.checkout_reset),
                            onClick = onClearAmount,
                            isError = true
                        )

                        QuickAmountChip(
                            text = stringResource(R.string.checkout_exact_amount),
                            onClick = onExactAmount,
                            isPrimary = true
                        )
                        
                        listOf(1_000L, 2_000L, 5_000L, 10_000L, 20_000L, 50_000L, 100_000L).forEach { amount ->
                            QuickAmountChip(
                                text = stringResource(
                                    R.string.checkout_quick_amount_plus,
                                    CurrencyFormatter.formatCurrency(amount, includeSymbol = false)
                                ),
                                onClick = { onQuickAmount(amount) }
                            )
                        }
                    }
                    
                    // Change display
                    AnimatedVisibility(visible = state.changeAmount > 0) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = Slate100,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = stringResource(R.string.checkout_change),
                                    style = MaterialTheme.typography.titleMedium
                                )
                                Text(
                                    text = CurrencyFormatter.formatCurrency(state.changeAmount),
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Slate900
                                )
                            }
                        }
                    }
                }
            }
            
            PaymentMethod.QRIS -> {
                // QR Logic
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.QrCode2,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = Slate900
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = stringResource(R.string.checkout_check_qr),
                        style = MaterialTheme.typography.titleMedium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                     Text(
                        text = stringResource(R.string.checkout_check_qr_desc),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
            
            PaymentMethod.TRANSFER -> {
                // Transfer Logic
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                     Icon(
                        imageVector = Icons.Default.AccountBalance,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = Slate900
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = stringResource(R.string.checkout_check_transfer),
                        style = MaterialTheme.typography.titleMedium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.checkout_check_transfer_desc),
                        style = MaterialTheme.typography.bodyMedium,
                         color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        // Confirm Button
        Button(
            onClick = onConfirm,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            enabled = state.canComplete && !state.isProcessing,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Brand500
            )
        ) {
            if (state.isProcessing) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
            } else {
                Icon(
                    imageVector = EvaIcons.Outline.CheckmarkCircle2,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.checkout_confirm_print),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun PaymentMethodButton(
    method: PaymentMethod,
    icon: ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val containerColor = if (isSelected) Brand500.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface
    val borderColor = if (isSelected) Brand500 else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)
    val iconTint = if (isSelected) Brand500 else Slate700
    val textColor = if (isSelected) Brand500 else MaterialTheme.colorScheme.onSurface

    Card(
        onClick = onClick,
        modifier = modifier.height(72.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = containerColor
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = iconTint
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = method.displayName,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                color = textColor
            )
        }
    }
}

@Composable
private fun CartItemRow(item: CartItem) {
    val priceFormatter = remember { CurrencyFormatter.getCurrencyFormatter() }
    
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 16.dp)) {
            Text(
                text = item.product.name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            
            if (item.hasCustomizations) {
                Text(
                    text = stringResource(R.string.checkout_item_customization, item.customizationSummary),
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate900,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
            
            Text(
                text = stringResource(
                    R.string.checkout_item_qty_price,
                    item.quantity,
                    priceFormatter.format(item.unitPrice)
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        
        Text(
            text = priceFormatter.format(item.subtotal),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun QuickAmountChip(
    text: String,
    onClick: () -> Unit,
    isPrimary: Boolean = false,
    isError: Boolean = false
) {
    val backgroundColor = when {
        isPrimary -> Brand500.copy(alpha = 0.15f)
        isError -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.2f)
        else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
    }

    val contentColor = when {
        isPrimary -> Brand500
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    val borderStroke = if (isError) {
        androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.3f))
    } else null

    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = backgroundColor,
        border = borderStroke,
        modifier = Modifier.height(56.dp)
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 24.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = contentColor
            )
        }
    }
}
